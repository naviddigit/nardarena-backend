import { Controller, Post, Get, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GameService } from './game.service';
import { CreateGameDto } from './dto/create-game.dto';
import { RecordMoveDto } from './dto/record-move.dto';
import { EndGameDto } from './dto/end-game.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('game')
@Controller('game')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create a new game' })
  @ApiResponse({ status: 201, description: 'Game created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createGame(@Req() req: any, @Body() createGameDto: CreateGameDto) {
    const userId = req.user.userId;
    return this.gameService.createGame(userId, createGameDto);
  }

  @Post(':id/move')
  @ApiOperation({ summary: 'Record a move in a game' })
  @ApiResponse({ status: 201, description: 'Move recorded successfully' })
  @ApiResponse({ status: 404, description: 'Game not found' })
  @ApiResponse({ status: 403, description: 'Not a player in this game' })
  async recordMove(
    @Req() req: any,
    @Param('id') gameId: string,
    @Body() recordMoveDto: RecordMoveDto,
  ) {
    const userId = req.user.userId;
    return this.gameService.recordMove(gameId, userId, recordMoveDto);
  }

  @Post(':id/end')
  @ApiOperation({ summary: 'End a game and record final result' })
  @ApiResponse({ status: 200, description: 'Game ended successfully' })
  @ApiResponse({ status: 404, description: 'Game not found' })
  @ApiResponse({ status: 403, description: 'Not a player in this game' })
  async endGame(
    @Req() req: any,
    @Param('id') gameId: string,
    @Body() endGameDto: EndGameDto,
  ) {
    const userId = req.user.userId;
    return this.gameService.endGame(gameId, userId, endGameDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get game details with all moves' })
  @ApiResponse({ status: 200, description: 'Game found' })
  @ApiResponse({ status: 404, description: 'Game not found' })
  @ApiResponse({ status: 403, description: 'Not a player in this game' })
  async getGame(@Req() req: any, @Param('id') gameId: string) {
    const userId = req.user.userId;
    return this.gameService.getGame(gameId, userId);
  }

  @Get('history/me')
  @ApiOperation({ summary: 'Get user game history' })
  @ApiResponse({ status: 200, description: 'Game history retrieved' })
  async getGameHistory(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const userId = req.user.userId;
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;
    return this.gameService.getUserGameHistory(userId, parsedLimit, parsedOffset);
  }
}
