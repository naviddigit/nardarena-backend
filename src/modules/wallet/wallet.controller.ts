import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GenerateWalletDto, WithdrawDto, ProcessDepositDto } from './dto/wallet.dto';
import { Network } from '@prisma/client';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  /**
   * Generate new wallet for user
   * POST /wallet/generate
   */
  @Post('generate')
  async generateWallet(@Request() req, @Body() dto: GenerateWalletDto) {
    const userId = req.user.userId;
    return this.walletService.generateWallet(userId, dto.network);
  }

  /**
   * Get user wallet by network
   * GET /wallet/:network
   */
  @Get(':network')
  async getWallet(@Request() req, @Param('network') network: string) {
    const userId = req.user.userId;
    
    // Validate network
    if (!Object.values(Network).includes(network as Network)) {
      throw new BadRequestException('Invalid network');
    }

    const wallet = await this.walletService.getWallet(userId, network as Network);
    
    if (!wallet) {
      // Auto-generate wallet if not exists
      return this.walletService.generateWallet(userId, network as Network);
    }

    return wallet;
  }

  /**
   * Get all user wallets
   * GET /wallet
   */
  @Get()
  async getUserWallets(@Request() req) {
    const userId = req.user.userId;
    return this.walletService.getUserWallets(userId);
  }

  /**
   * Check wallet balance from blockchain
   * POST /wallet/check-balance
   */
  @Post('check-balance')
  async checkBalance(@Request() req, @Body('walletId') walletId: string) {
    if (!walletId) {
      throw new BadRequestException('walletId is required');
    }
    
    const balance = await this.walletService.checkBalance(walletId);
    return { balance };
  }

  /**
   * Notify about new deposit
   * Called by frontend when it detects a deposit
   * POST /wallet/notify-deposit
   */
  @Post('notify-deposit')
  async notifyDeposit(@Body() dto: ProcessDepositDto) {
    // This endpoint allows frontend to notify backend about deposits
    // Backend will verify the transaction before processing
    return { message: 'Deposit notification received', txHash: dto.txHash };
  }

  /**
   * Request withdrawal
   * POST /wallet/withdraw
   */
  @Post('withdraw')
  async requestWithdrawal(@Request() req, @Body() dto: WithdrawDto) {
    const userId = req.user.userId;
    return this.walletService.requestWithdrawal(
      userId,
      dto.network,
      dto.toAddress,
      dto.amount
    );
  }

  /**
   * Get user deposits
   * GET /wallet/deposits
   */
  @Get('transactions/deposits')
  async getDeposits(@Request() req) {
    const userId = req.user.userId;
    return this.walletService.getUserDeposits(userId);
  }

  /**
   * Get user withdrawals
   * GET /wallet/withdrawals
   */
  @Get('transactions/withdrawals')
  async getWithdrawals(@Request() req) {
    const userId = req.user.userId;
    return this.walletService.getUserWithdrawals(userId);
  }
}
