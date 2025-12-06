import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../../database/database.module';
import { SettingsModule } from '../settings/settings.module';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { GameGateway } from './game.gateway';
import { GameService } from '../game/game.service';
import { GameController } from '../game/game.controller';
import { AIPlayerService } from '../game/ai/ai-player.service';
import { DiceService } from '../game/dice.service';

@Module({
  imports: [AuthModule, DatabaseModule, SettingsModule],
  controllers: [GamesController, GameController],
  providers: [GamesService, GameService, GameGateway, AIPlayerService, DiceService],
  exports: [GamesService, GameService, AIPlayerService, DiceService],
})
export class GamesModule {}
