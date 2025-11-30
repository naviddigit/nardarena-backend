import { IsEnum, IsString, IsNumber, Min, IsNotEmpty } from 'class-validator';
import { Network } from '@prisma/client';

export class GenerateWalletDto {
  @IsEnum(Network)
  @IsNotEmpty()
  network: Network;
}

export class WithdrawDto {
  @IsEnum(Network)
  @IsNotEmpty()
  network: Network;

  @IsString()
  @IsNotEmpty()
  toAddress: string;

  @IsNumber()
  @Min(0.01)
  amount: number;
}

export class CheckBalanceDto {
  @IsString()
  @IsNotEmpty()
  walletId: string;
}

export class ProcessDepositDto {
  @IsString()
  @IsNotEmpty()
  walletId: string;

  @IsString()
  @IsNotEmpty()
  txHash: string;
}
