import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { GamesModule } from './modules/games/games.module';
import { AdminModule } from './modules/admin/admin.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { SettingsModule } from './modules/settings/settings.module';
import { HealthController } from './common/controllers/health.controller';

@Module({
  imports: [
    // Configuration module (environment variables)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Schedule module for cron jobs
    ScheduleModule.forRoot(),

    // Rate limiting (security)
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 100, // 100 requests per minute
      },
    ]),

    // Database module (Prisma)
    DatabaseModule,

    // Feature modules
    AuthModule,
    UsersModule,
    GamesModule,
    AdminModule,
    WalletModule,
    SettingsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
