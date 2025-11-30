import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { WalletService } from './wallet.service';

@Injectable()
export class WalletCronService {
  private readonly logger = new Logger(WalletCronService.name);

  constructor(
    private prisma: PrismaService,
    private walletService: WalletService
  ) {}

  /**
   * Check wallet balances every 10 minutes
   * Configurable via system_settings
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async checkWalletBalances() {
    this.logger.log('🔍 Starting wallet balance check...');

    try {
      // Get settings
      const historyHours = parseInt(
        (await this.prisma.systemSetting.findUnique({
          where: { key: 'wallet_check_history_hours' },
        }))?.value || '10'
      );

      // Get wallets created within last X hours
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - historyHours);

      const wallets = await this.prisma.userWallet.findMany({
        where: {
          createdAt: {
            gte: cutoffTime,
          },
          isActive: true,
        },
        take: 200, // Process max 200 wallets per run
        orderBy: {
          lastCheckedAt: 'asc', // Check oldest first
        },
      });

      this.logger.log(`Found ${wallets.length} wallets to check`);

      let checkedCount = 0;
      let depositsFound = 0;

      // Check each wallet
      for (const wallet of wallets) {
        try {
          const oldBalance = Number(wallet.balance);
          const newBalance = await this.walletService.checkBalance(wallet.id);
          const newBalanceNum = parseFloat(newBalance);

          // If balance increased, there's a deposit
          if (newBalanceNum > oldBalance) {
            const depositAmount = newBalanceNum - oldBalance;
            this.logger.log(
              `💰 Deposit detected! Wallet ${wallet.address}: +$${depositAmount}`
            );

            // TODO: Fetch actual transaction details from blockchain
            // For now, we'll just log it
            depositsFound++;
          }

          checkedCount++;
        } catch (error) {
          this.logger.error(
            `Failed to check wallet ${wallet.id}: ${error.message}`
          );
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      this.logger.log(
        `✅ Balance check completed. Checked: ${checkedCount}, Deposits found: ${depositsFound}`
      );
    } catch (error) {
      this.logger.error(`❌ Balance check failed: ${error.message}`);
    }
  }

  /**
   * Process pending withdrawals (if auto-enabled)
   * Runs every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processPendingWithdrawals() {
    try {
      // Check if auto-withdraw is enabled
      const autoEnabled = await this.prisma.systemSetting.findUnique({
        where: { key: 'auto_withdraw_enabled' },
      });

      if (autoEnabled?.value !== 'true') {
        return; // Skip if auto-withdraw is disabled
      }

      this.logger.log('💸 Processing pending withdrawals...');

      // Get pending withdrawals
      const pending = await this.prisma.withdrawal.findMany({
        where: {
          status: 'PENDING',
        },
        take: 10, // Process max 10 per run
        orderBy: {
          requestedAt: 'asc',
        },
      });

      if (pending.length === 0) {
        return;
      }

      this.logger.log(`Found ${pending.length} pending withdrawals`);

      let processed = 0;
      let failed = 0;

      for (const withdrawal of pending) {
        try {
          await this.walletService.processWithdrawal(withdrawal.id);
          this.logger.log(
            `✅ Processed withdrawal ${withdrawal.id} for user ${withdrawal.userId}`
          );
          processed++;
        } catch (error) {
          this.logger.error(
            `❌ Failed to process withdrawal ${withdrawal.id}: ${error.message}`
          );
          failed++;
        }

        // Delay between transactions
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      this.logger.log(
        `Withdrawal processing completed. Processed: ${processed}, Failed: ${failed}`
      );
    } catch (error) {
      this.logger.error(`Withdrawal processing error: ${error.message}`);
    }
  }

  /**
   * Settlement to master wallet (daily at 2 AM)
   */
  @Cron('0 2 * * *')
  async settlementToMasterWallet() {
    try {
      // Check if auto-settlement is enabled
      const autoEnabled = await this.prisma.systemSetting.findUnique({
        where: { key: 'auto_settlement_enabled' },
      });

      if (autoEnabled?.value !== 'true') {
        return;
      }

      this.logger.log('🏦 Starting settlement to master wallets...');

      const threshold = parseFloat(
        (await this.prisma.systemSetting.findUnique({
          where: { key: 'settlement_threshold_usd' },
        }))?.value || '1000'
      );

      // Get wallets with balance >= threshold
      const walletsToSettle = await this.prisma.userWallet.findMany({
        where: {
          balance: {
            gte: threshold,
          },
          isActive: true,
        },
      });

      this.logger.log(`Found ${walletsToSettle.length} wallets to settle`);

      // TODO: Implement actual settlement logic
      // This requires transferring funds from user wallets to master wallet

      this.logger.log('Settlement completed');
    } catch (error) {
      this.logger.error(`Settlement error: ${error.message}`);
    }
  }
}
