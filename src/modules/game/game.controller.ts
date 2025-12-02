import { Controller, Post, Get, Body, Param, Query, UseGuards, Req, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GameService } from './game.service';
import { DiceService } from './dice.service';
import { CreateGameDto } from './dto/create-game.dto';
import { RecordMoveDto } from './dto/record-move.dto';
import { EndGameDto } from './dto/end-game.dto';
import { AIMoveRequestDto } from './dto/ai-move.dto';
import { SyncStateDto } from './dto/sync-state.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AIPlayerService } from './ai/ai-player.service';

@ApiTags('game')
@Controller('game')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GameController {
  constructor(
    private readonly gameService: GameService,
    private readonly aiPlayerService: AIPlayerService,
    private readonly diceService: DiceService,
  ) {}

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

  @Post('ai-move')
  @ApiOperation({ summary: 'Test AI move generation' })
  @ApiResponse({ status: 200, description: 'AI move generated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid board state or dice roll' })
  async getAIMove(@Body() aiMoveRequestDto: AIMoveRequestDto) {
    const boardState = {
      points: aiMoveRequestDto.points,
      bar: aiMoveRequestDto.bar,
      off: aiMoveRequestDto.off,
      currentPlayer: aiMoveRequestDto.currentPlayer,
    };

    const moves = await this.aiPlayerService.makeMove(
      boardState,
      aiMoveRequestDto.diceRoll,
      aiMoveRequestDto.difficulty,
    );

    return {
      moves,
      difficulty: aiMoveRequestDto.difficulty,
      diceRoll: aiMoveRequestDto.diceRoll,
    };
  }

  @Post(':id/ai-move')
  @ApiOperation({ summary: 'Trigger AI to make its move in a game' })
  @ApiResponse({ status: 200, description: 'AI move completed' })
  @ApiResponse({ status: 400, description: 'Not an AI game or not AI turn' })
  async triggerAIMove(@Req() req: any, @Param('id') gameId: string) {
    return this.gameService.makeAIMove(gameId);
  }

  @Patch(':id/sync-state')
  @ApiOperation({ summary: 'Sync game state (for dice rolls, phase changes, etc.)' })
  @ApiResponse({ status: 200, description: 'State synced successfully' })
  @ApiResponse({ status: 404, description: 'Game not found' })
  async syncGameState(
    @Req() req: any,
    @Param('id') gameId: string,
    @Body() syncStateDto: SyncStateDto,
  ) {
    const userId = req.user.userId;
    return this.gameService.syncGameState(gameId, userId, syncStateDto);
  }

  @Post('dice/roll')
  @ApiOperation({ summary: 'Roll two dice (server-side for fairness)' })
  @ApiResponse({ status: 200, description: 'Dice rolled successfully' })
  rollDice() {
    const dice = this.diceService.rollTwoDice();
    return {
      dice,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('dice/opening')
  @ApiOperation({ summary: 'Roll opening dice (one per player, no ties)' })
  @ApiResponse({ status: 200, description: 'Opening dice rolled successfully' })
  rollOpeningDice() {
    const result = this.diceService.rollOpeningDice();
    return {
      white: result.white,
      black: result.black,
      winner: result.white > result.black ? 'white' : 'black',
      timestamp: new Date().toISOString(),
    };
  }
}
