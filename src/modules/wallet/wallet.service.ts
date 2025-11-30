import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Network } from '@prisma/client';
import {
  encryptPrivateKey,
  decryptPrivateKey,
} from '../../utils/crypto.util';
import {
  generateBscWallet,
  generateTrc20Wallet,
  getBscUsdtBalance,
  getTrc20UsdtBalance,
  getNetworkConfig,
  sendBscUsdt,
  sendTrc20Usdt,
} from '../../utils/wallet.util';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get system setting by key
   */
  private async getSetting(key: string): Promise<string> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key },
    });
    return setting?.value || '';
  }

  /**
   * Get multiple system settings by category
   */
  private async getSettingsByCategory(category: string) {
    const settings = await this.prisma.systemSetting.findMany({
      where: { category },
    });
    return settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
  }

  /**
   * Check if testnet mode is enabled
   */
  private async isTestnet(): Promise<boolean> {
    const useTestnet = await this.getSetting('use_testnet');
    return useTestnet === 'true';
  }

  /**
   * Generate new wallet for user
   */
  async generateWallet(userId: string, network: Network) {
    // Check if user already has wallet for this network
    const existing = await this.prisma.userWallet.findUnique({
      where: {
        userId_network: { userId, network },
      },
    });

    if (existing) {
      // Return existing wallet (without private key)
      return {
        address: existing.address,
        network: existing.network,
        balance: existing.balance.toString(),
        createdAt: existing.createdAt,
      };
    }

    // Get testnet setting
    const useTestnet = await this.isTestnet();

    // Generate new wallet based on network
    let walletData: { address: string; privateKey: string };

    if (network === Network.BSC) {
      walletData = generateBscWallet();
    } else if (network === Network.TRC20) {
      walletData = generateTrc20Wallet(useTestnet);
    } else {
      throw new BadRequestException('Unsupported network');
    }

    // Encrypt private key
    const { encryptedPrivateKey, salt } = encryptPrivateKey(
      walletData.privateKey
    );

    // Save to database
    const wallet = await this.prisma.userWallet.create({
      data: {
        userId,
        network,
        address: walletData.address,
        encryptedPrivateKey,
        salt,
        balance: 0,
      },
    });

    return {
      address: wallet.address,
      network: wallet.network,
      balance: wallet.balance.toString(),
      createdAt: wallet.createdAt,
    };
  }

  /**
   * Get user wallet by network
   */
  async getWallet(userId: string, network: Network) {
    const wallet = await this.prisma.userWallet.findUnique({
      where: {
        userId_network: { userId, network },
      },
    });

    if (!wallet) {
      return null;
    }

    return {
      id: wallet.id,
      address: wallet.address,
      network: wallet.network,
      balance: wallet.balance.toString(),
      lastCheckedAt: wallet.lastCheckedAt,
      createdAt: wallet.createdAt,
    };
  }

  /**
   * Get user wallets (all networks)
   */
  async getUserWallets(userId: string) {
    const wallets = await this.prisma.userWallet.findMany({
      where: { userId, isActive: true },
    });

    return wallets.map((w) => ({
      id: w.id,
      address: w.address,
      network: w.network,
      balance: w.balance.toString(),
      lastCheckedAt: w.lastCheckedAt,
      createdAt: w.createdAt,
    }));
  }

  /**
   * Check wallet balance from blockchain
   */
  async checkBalance(walletId: string): Promise<string> {
    const wallet = await this.prisma.userWallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const useTestnet = await this.isTestnet();
    const config = getNetworkConfig(wallet.network, useTestnet);

    let balance: string;

    if (wallet.network === Network.BSC) {
      balance = await getBscUsdtBalance(
        wallet.address,
        config.contractAddress,
        config.rpcUrl
      );
    } else if (wallet.network === Network.TRC20) {
      balance = await getTrc20UsdtBalance(
        wallet.address,
        config.contractAddress,
        config.rpcUrl
      );
    } else {
      throw new BadRequestException('Unsupported network');
    }

    // Update wallet balance and lastCheckedAt
    await this.prisma.userWallet.update({
      where: { id: walletId },
      data: {
        balance: parseFloat(balance),
        lastCheckedAt: new Date(),
      },
    });

    return balance;
  }

  /**
   * Process deposit transaction
   * Called when new deposit is detected
   */
  async processDeposit(
    walletId: string,
    txHash: string,
    amount: string,
    fromAddress: string,
    blockNumber?: bigint
  ) {
    const wallet = await this.prisma.userWallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    // Check if deposit already exists
    const existing = await this.prisma.deposit.findUnique({
      where: { txHash },
    });

    if (existing) {
      return existing;
    }

    // Create deposit record and update user balance in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create deposit
      const deposit = await tx.deposit.create({
        data: {
          userId: wallet.userId,
          walletId: wallet.id,
          network: wallet.network,
          txHash,
          fromAddress,
          toAddress: wallet.address,
          amount: parseFloat(amount),
          blockNumber,
          status: 'CONFIRMED',
          confirmedAt: new Date(),
        },
      });

      // Update user balance
      await tx.userStats.update({
        where: { userId: wallet.userId },
        data: {
          balance: {
            increment: parseFloat(amount),
          },
        },
      });

      return deposit;
    });

    return result;
  }

  /**
   * Request withdrawal
   */
  async requestWithdrawal(
    userId: string,
    network: Network,
    toAddress: string,
    amount: number
  ) {
    // Get user stats for balance check
    const userStats = await this.prisma.userStats.findUnique({
      where: { userId },
    });

    if (!userStats) {
      throw new NotFoundException('User not found');
    }

    // Get user info for email verification check
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check email verification requirement
    const requireEmailVerified = await this.getSetting('require_email_verified');
    if (requireEmailVerified === 'true' && !user.emailVerified) {
      throw new BadRequestException('Email verification required for withdrawal');
    }

    // Get withdrawal settings
    const minAmount = parseFloat(await this.getSetting('min_withdraw_amount'));
    const maxAmount = parseFloat(await this.getSetting('max_withdraw_amount'));

    // Validate amount
    if (amount < minAmount) {
      throw new BadRequestException(`Minimum withdrawal amount is $${minAmount}`);
    }

    if (amount > maxAmount) {
      throw new BadRequestException(`Maximum withdrawal amount is $${maxAmount}`);
    }

    // Check daily limit
    const maxDailyAmount = parseFloat(
      await this.getSetting('max_daily_withdraw_per_user')
    );
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayWithdrawals = await this.prisma.withdrawal.aggregate({
      where: {
        userId,
        requestedAt: {
          gte: todayStart,
        },
        status: {
          in: ['PENDING', 'PROCESSING', 'COMPLETED'],
        },
      },
      _sum: {
        amount: true,
      },
    });

    const todayTotal = Number(todayWithdrawals._sum.amount || 0);
    if (todayTotal + amount > maxDailyAmount) {
      throw new BadRequestException(
        `Daily withdrawal limit exceeded. Limit: $${maxDailyAmount}, Used: $${todayTotal}`
      );
    }

    // Calculate fees
    const networkFeeKey = network === Network.TRC20 ? 'trc20_network_fee_usd' : 'bsc_network_fee_usd';
    const networkFee = parseFloat(await this.getSetting(networkFeeKey));
    const feePercent = parseFloat(await this.getSetting('withdraw_fee_percent'));
    const serviceFee = networkFee * (feePercent / 100);
    const totalFee = networkFee + serviceFee;

    // Check if user has enough balance
    const totalRequired = amount + totalFee;
    if (Number(userStats.balance) < totalRequired) {
      throw new BadRequestException(
        `Insufficient balance. Required: $${totalRequired.toFixed(2)} (including fee $${totalFee.toFixed(2)}), Available: $${userStats.balance}`
      );
    }

    // Create withdrawal request and deduct balance in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create withdrawal record
      const withdrawal = await tx.withdrawal.create({
        data: {
          userId,
          network,
          toAddress,
          amount,
          networkFee,
          serviceFee,
          totalFee,
          status: 'PENDING',
        },
      });

      // Deduct balance immediately
      await tx.userStats.update({
        where: { userId },
        data: {
          balance: {
            decrement: totalRequired,
          },
        },
      });

      return withdrawal;
    });

    return {
      id: result.id,
      amount: result.amount.toString(),
      networkFee: result.networkFee.toString(),
      serviceFee: result.serviceFee.toString(),
      totalFee: result.totalFee.toString(),
      status: result.status,
      requestedAt: result.requestedAt,
    };
  }

  /**
   * Process withdrawal (send transaction)
   * Should be called by admin or automated process
   */
  async processWithdrawal(withdrawalId: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new NotFoundException('Withdrawal not found');
    }

    if (withdrawal.status !== 'PENDING') {
      throw new BadRequestException(
        `Withdrawal cannot be processed. Current status: ${withdrawal.status}`
      );
    }

    // Get master wallet for this network
    const masterWallet = await this.prisma.masterWallet.findUnique({
      where: { network: withdrawal.network },
    });

    if (!masterWallet || !masterWallet.isActive) {
      throw new BadRequestException('Master wallet not configured for this network');
    }

    // Decrypt master wallet private key
    const privateKey = decryptPrivateKey(
      masterWallet.encryptedPrivateKey,
      masterWallet.salt
    );

    const useTestnet = await this.isTestnet();
    const config = getNetworkConfig(withdrawal.network, useTestnet);

    // Update status to processing
    await this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: 'PROCESSING',
        processedAt: new Date(),
      },
    });

    try {
      let txHash: string;

      // Send transaction
      if (withdrawal.network === Network.BSC) {
        txHash = await sendBscUsdt(
          privateKey,
          withdrawal.toAddress,
          withdrawal.amount.toString(),
          config.contractAddress,
          config.rpcUrl
        );
      } else if (withdrawal.network === Network.TRC20) {
        txHash = await sendTrc20Usdt(
          privateKey,
          withdrawal.toAddress,
          withdrawal.amount.toString(),
          config.contractAddress,
          config.rpcUrl
        );
      } else {
        throw new BadRequestException('Unsupported network');
      }

      // Update withdrawal with txHash and mark as completed
      const updated = await this.prisma.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          txHash,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      return {
        id: updated.id,
        txHash: updated.txHash,
        status: updated.status,
        completedAt: updated.completedAt,
      };
    } catch (error) {
      // Mark as failed and refund user
      await this.prisma.$transaction(async (tx) => {
        await tx.withdrawal.update({
          where: { id: withdrawalId },
          data: {
            status: 'FAILED',
            adminNote: error.message,
          },
        });

        // Refund balance
        const totalRefund = Number(withdrawal.amount) + Number(withdrawal.totalFee);
        await tx.userStats.update({
          where: { userId: withdrawal.userId },
          data: {
            balance: {
              increment: totalRefund,
            },
          },
        });
      });

      throw error;
    }
  }

  /**
   * Get user deposits
   */
  async getUserDeposits(userId: string, limit: number = 10) {
    const deposits = await this.prisma.deposit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return deposits.map((d) => ({
      id: d.id,
      network: d.network,
      txHash: d.txHash,
      amount: d.amount.toString(),
      status: d.status,
      confirmedAt: d.confirmedAt,
      createdAt: d.createdAt,
    }));
  }

  /**
   * Get user withdrawals
   */
  async getUserWithdrawals(userId: string, limit: number = 10) {
    const withdrawals = await this.prisma.withdrawal.findMany({
      where: { userId },
      orderBy: { requestedAt: 'desc' },
      take: limit,
    });

    return withdrawals.map((w) => ({
      id: w.id,
      network: w.network,
      toAddress: w.toAddress,
      amount: w.amount.toString(),
      totalFee: w.totalFee.toString(),
      txHash: w.txHash,
      status: w.status,
      requestedAt: w.requestedAt,
      completedAt: w.completedAt,
    }));
  }
}
