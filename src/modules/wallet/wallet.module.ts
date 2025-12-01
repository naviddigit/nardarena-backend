import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { WalletCronService } from './wallet-cron.service';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [WalletController],
  providers: [WalletService, WalletCronService],
  exports: [WalletService],
})
export class WalletModule {}
