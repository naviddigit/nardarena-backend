import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { AIPlayerService } from './ai/ai-player.service';
import { DiceService } from './dice.service';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [DatabaseModule, AuthModule, SettingsModule],
  controllers: [GameController],
  providers: [GameService, AIPlayerService, DiceService],
  exports: [GameService, AIPlayerService, DiceService],
})
export class GameModule {}
