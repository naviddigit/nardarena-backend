import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { AIPlayerService } from './ai/ai-player.service';
import { DiceService } from './dice.service';
import { OpeningRollService } from './core/opening-roll.service';
import { AIMoveService } from './core/ai-move.service';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [DatabaseModule, AuthModule, SettingsModule],
  controllers: [GameController],
  providers: [
    GameService,
    GameGateway,
    AIPlayerService,
    DiceService,
    OpeningRollService,
    AIMoveService,
  ],
  exports: [
    GameService,
    GameGateway,
    AIPlayerService,
    DiceService,
    OpeningRollService,
    AIMoveService,
  ],
})
export class GameModule {}
