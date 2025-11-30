import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../../database/database.module';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { GameGateway } from './game.gateway';
import { GameService } from '../game/game.service';
import { GameController } from '../game/game.controller';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [GamesController, GameController],
  providers: [GamesService, GameService, GameGateway],
  exports: [GamesService, GameService],
})
export class GamesModule {}
