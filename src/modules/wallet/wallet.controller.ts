import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
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
  async generateWallet(@Request() req: any, @Body() dto: GenerateWalletDto) {
    const userId = req.user.sub || req.user.id;
    return this.walletService.generateWallet(userId, dto.network);
  }

  /**
   * Get user wallet by network
   * GET /wallet/:network
   */
  @Get(':network')
  async getWallet(@Request() req: any, @Param('network') network: string) {
    console.log('🔍 req.user:', JSON.stringify(req.user, null, 2));
    const userId = req.user.sub || req.user.id;
    console.log('🔍 userId extracted:', userId);
    
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
  async getUserWallets(@Request() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.walletService.getUserWallets(userId);
  }

  /**
   * Check wallet balance from blockchain
   * POST /wallet/check-balance
   */
  @Post('check-balance')
  async checkBalance(@Request() req: any, @Body('walletId') walletId: string) {
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
  async requestWithdrawal(@Request() req: any, @Body() dto: WithdrawDto) {
    const userId = req.user.sub || req.user.id;
    return this.walletService.requestWithdrawal(
      userId,
      dto.network,
      dto.toAddress,
      dto.amount
    );
  }

  /**
   * Get user deposits
   * GET /wallet/transactions/deposits
   */
  @Get('transactions/deposits')
  async getDeposits(@Request() req: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    const userId = req.user.sub || req.user.id;
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const data = await this.walletService.getUserDeposits(userId, limitNum);
    
    return {
      data,
      total: data.length,
      page: pageNum,
      limit: limitNum,
    };
  }

  /**
   * Get user withdrawals
   * GET /wallet/transactions/withdrawals
   */
  @Get('transactions/withdrawals')
  async getWithdrawals(@Request() req: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    const userId = req.user.sub || req.user.id;
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const data = await this.walletService.getUserWithdrawals(userId, limitNum);
    
    return {
      data,
      total: data.length,
      page: pageNum,
      limit: limitNum,
    };
  }
}
