import { Module } from '@nestjs/common';
import { BotUserController } from './bot-user.controller';
import { BotUserService } from './bot-user.service';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [BotUserController],
  providers: [BotUserService],
  exports: [BotUserService],
})
export class BotUserModule {}
