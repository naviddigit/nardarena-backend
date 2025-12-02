import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { AIPlayerService } from './ai/ai-player.service';
import { DiceService } from './dice.service';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [GameController],
  providers: [GameService, AIPlayerService, DiceService],
  exports: [GameService, AIPlayerService, DiceService],
})
export class GameModule {}
