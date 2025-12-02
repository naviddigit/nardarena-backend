/**
 * ⚠️ WARNING: بخش‌هایی از این فایل تست شده و critical هستند!
 * لطفاً قبل از تغییر هر تابع، مستندات و کامنت‌های موجود را بخوانید.
 * توابع applyMove و convert format ها critical هستند.
 */

import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateGameDto } from './dto/create-game.dto';
import { RecordMoveDto } from './dto/record-move.dto';
import { EndGameDto } from './dto/end-game.dto';
import { AIPlayerService, AIDifficulty } from './ai/ai-player.service';

@Injectable()
export class GameService {
  constructor(
    private prisma: PrismaService,
    private aiPlayerService: AIPlayerService,
  ) {}

  // AI Player ID (system user for AI games)
  private readonly AI_PLAYER_ID = '00000000-0000-0000-0000-000000000001';

  async createGame(userId: string, createGameDto: CreateGameDto) {
    const { gameType, opponentId, timeControl = 120, gameMode = 'CLASSIC', aiDifficulty = 'MEDIUM' } = createGameDto;

    // Determine opponent based on game type
    let blackPlayerId: string;
    
    if (gameType === 'AI') {
      blackPlayerId = this.AI_PLAYER_ID;
    } else if (gameType === 'ONLINE') {
      if (!opponentId) {
        throw new BadRequestException('Opponent ID is required for ONLINE games');
      }
      blackPlayerId = opponentId;
    } else {
      // TOURNAMENT - will be handled in tournament module
      throw new BadRequestException('Tournament games must be created through tournament system');
    }

    // Create initial standard backgammon board state
    const initialBoardState = {
      points: [
        { white: 2, black: 0 },  // Point 0
        { white: 0, black: 0 },
        { white: 0, black: 0 },
        { white: 0, black: 0 },
        { white: 0, black: 0 },
        { white: 0, black: 5 },  // Point 5
        { white: 0, black: 0 },
        { white: 0, black: 3 },
        { white: 0, black: 0 },
        { white: 0, black: 0 },
        { white: 0, black: 0 },
        { white: 5, black: 0 },  // Point 11
        { white: 5, black: 0 },  // Point 12
        { white: 0, black: 0 },
        { white: 0, black: 0 },
        { white: 0, black: 0 },
        { white: 3, black: 0 },  // Point 16
        { white: 0, black: 5 },
        { white: 0, black: 0 },
        { white: 0, black: 3 },
        { white: 0, black: 0 },
        { white: 0, black: 0 },
        { white: 0, black: 0 },
        { white: 0, black: 2 },  // Point 23
      ],
      bar: { white: 0, black: 0 },
      off: { white: 0, black: 0 },
      currentPlayer: 'white',
      phase: 'opening',
      aiDifficulty: gameType === 'AI' ? aiDifficulty : undefined,
    };

    const game = await this.prisma.game.create({
      data: {
        whitePlayerId: userId,
        blackPlayerId,
        gameType,
        gameMode,
        timeControl,
        gameState: initialBoardState,
        moveHistory: [],
        status: 'ACTIVE',
        startedAt: new Date(),
      },
      include: {
        whitePlayer: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
          },
        },
        blackPlayer: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
          },
        },
      },
    });

    return game;
  }

  async recordMove(gameId: string, userId: string, recordMoveDto: RecordMoveDto) {
    // Verify game exists and user is a player
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    if (game.status !== 'ACTIVE') {
      throw new BadRequestException('Game is not active');
    }

    // Verify user is a player in this game
    if (game.whitePlayerId !== userId && game.blackPlayerId !== userId) {
      throw new ForbiddenException('You are not a player in this game');
    }

    // Record the move
    const move = await this.prisma.gameMove.create({
      data: {
        gameId,
        playerColor: recordMoveDto.playerColor,
        moveNumber: recordMoveDto.moveNumber,
        from: recordMoveDto.from,
        to: recordMoveDto.to,
        diceUsed: recordMoveDto.diceUsed,
        isHit: recordMoveDto.isHit || false,
        boardStateBefore: recordMoveDto.boardStateBefore,
        boardStateAfter: recordMoveDto.boardStateAfter,
        timeRemaining: recordMoveDto.timeRemaining,
        moveTime: recordMoveDto.moveTime,
      },
    });

    // Update game's moveHistory (append move data)
    const moveData = {
      moveNumber: recordMoveDto.moveNumber,
      player: recordMoveDto.playerColor,
      from: recordMoveDto.from,
      to: recordMoveDto.to,
      dice: recordMoveDto.diceUsed,
      timestamp: new Date().toISOString(),
    };

    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        moveHistory: {
          push: moveData,
        },
        gameState: recordMoveDto.boardStateAfter || game.gameState,
        updatedAt: new Date(),
      },
    });

    // If this is an AI game and player just finished their turn, trigger AI move
    const shouldTriggerAI = 
      game.gameType === 'AI' && 
      recordMoveDto.boardStateAfter && 
      (recordMoveDto.boardStateAfter as any).currentPlayer === 'black';

    if (shouldTriggerAI) {
      console.log('🤖 AI\'s turn detected, triggering AI move...');
      // Trigger AI move in background (non-blocking)
      setImmediate(async () => {
        try {
          await this.makeAIMove(gameId);
          console.log('✅ AI move completed');
        } catch (error) {
          console.error('❌ AI move failed:', error);
        }
      });
    }

    return { move };
  }

  async endGame(gameId: string, userId: string, endGameDto: EndGameDto) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        whitePlayer: true,
        blackPlayer: true,
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    if (game.status !== 'ACTIVE') {
      throw new BadRequestException('Game is already ended');
    }

    // Verify user is a player
    if (game.whitePlayerId !== userId && game.blackPlayerId !== userId) {
      throw new ForbiddenException('You are not a player in this game');
    }

    // Update game status
    const updatedGame = await this.prisma.game.update({
      where: { id: gameId },
      data: {
        status: 'COMPLETED',
        winner: endGameDto.winner,
        whiteSetsWon: endGameDto.whiteSetsWon,
        blackSetsWon: endGameDto.blackSetsWon,
        endReason: endGameDto.endReason || 'NORMAL_WIN',
        endedAt: new Date(),
        gameState: endGameDto.finalGameState || game.gameState,
      },
    });

    // Update user stats for both players
    const winnerUserId = endGameDto.winner === 'WHITE' ? game.whitePlayerId : game.blackPlayerId;
    const loserUserId = endGameDto.winner === 'WHITE' ? game.blackPlayerId : game.whitePlayerId;

    // Only update stats for real users (not AI)
    if (winnerUserId !== this.AI_PLAYER_ID) {
      await this.updateUserStats(winnerUserId, true, endGameDto.whiteSetsWon + endGameDto.blackSetsWon);
    }
    
    if (loserUserId !== this.AI_PLAYER_ID) {
      await this.updateUserStats(loserUserId, false, endGameDto.whiteSetsWon + endGameDto.blackSetsWon);
    }

    return updatedGame;
  }

  async getGame(gameId: string, userId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        whitePlayer: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
          },
        },
        blackPlayer: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
          },
        },
        moves: {
          orderBy: { moveNumber: 'asc' },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Users can only view their own games
    if (game.whitePlayerId !== userId && game.blackPlayerId !== userId) {
      throw new ForbiddenException('You are not a player in this game');
    }

    return game;
  }

  async getUserGameHistory(userId: string, limit: number = 20, offset: number = 0) {
    const games = await this.prisma.game.findMany({
      where: {
        OR: [
          { whitePlayerId: userId },
          { blackPlayerId: userId },
        ],
        // Include both ACTIVE and COMPLETED games
        status: {
          in: ['ACTIVE', 'COMPLETED'],
        },
      },
      include: {
        whitePlayer: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
          },
        },
        blackPlayer: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
          },
        },
      },
      orderBy: [
        // Active games first
        { status: 'asc' },
        // Then sort by updated/ended time
        { updatedAt: 'desc' },
      ],
      take: limit,
      skip: offset,
    });

    const total = await this.prisma.game.count({
      where: {
        OR: [
          { whitePlayerId: userId },
          { blackPlayerId: userId },
        ],
        status: {
          in: ['ACTIVE', 'COMPLETED'],
        },
      },
    });

    return {
      games,
      total,
      limit,
      offset,
    };
  }

  /**
   * Sync game state (for dice rolls, phase changes, etc.)
   */
  async syncGameState(gameId: string, userId: string, syncStateDto: any) {
    // Verify game exists and user is a player
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    if (game.whitePlayerId !== userId && game.blackPlayerId !== userId) {
      throw new ForbiddenException('Not a player in this game');
    }

    // Merge dice values into game state
    const updatedGameState = {
      ...syncStateDto.gameState,
      diceValues: syncStateDto.diceValues || [],
    };

    console.log('🔄 Syncing state with dice values:', syncStateDto.diceValues);

    // Update game state
    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        gameState: updatedGameState,
        updatedAt: new Date(),
      },
    });

    return { 
      message: 'State synced successfully',
      gameState: updatedGameState,
    };
  }

  /**
   * AI automatically makes its move
   */
  async makeAIMove(gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    if (game.gameType !== 'AI') {
      throw new BadRequestException('This is not an AI game');
    }

    if (game.status !== 'ACTIVE') {
      throw new BadRequestException('Game is not active');
    }

    const gameState = game.gameState as any;
    
    // Check if it's AI's turn (black player)
    if (gameState.currentPlayer !== 'black') {
      throw new BadRequestException('Not AI turn');
    }

    // Use dice values from synced state (already rolled by frontend)
    let diceRoll: [number, number];
    
    if (gameState.diceValues && gameState.diceValues.length >= 2) {
      // Use the dice that were already rolled
      diceRoll = [gameState.diceValues[0], gameState.diceValues[1]];
      console.log('🎲 Using synced dice values:', diceRoll);
    } else {
      // Fallback: Roll new dice if not provided
      const dice1 = Math.floor(Math.random() * 6) + 1;
      const dice2 = Math.floor(Math.random() * 6) + 1;
      diceRoll = [dice1, dice2];
      console.log('⚠️ No dice values in state, rolled new dice:', diceRoll);
    }

    // Get AI difficulty from game state
    const difficulty = (gameState.aiDifficulty || 'MEDIUM') as AIDifficulty;

    // Simulate thinking time
    await this.aiPlayerService.simulateThinkingTime(difficulty);

    // Convert frontend board state format to AI format
    const boardState = this.convertToAIFormat(gameState);
    console.log('🔄 Converted board state for AI:', JSON.stringify(boardState, null, 2));

    const moves = await this.aiPlayerService.makeMove(boardState, diceRoll, difficulty);
    console.log('🤖 AI calculated moves:', moves);

    // Apply moves to board state (AI format)
    let currentBoard = { ...boardState };
    for (const move of moves) {
      currentBoard = this.applyMove(currentBoard, move);
    }

    // Convert back to frontend format
    const newGameState = this.convertFromAIFormat(currentBoard, gameState);
    console.log('✅ Converted back to frontend format');

    // Update game state in database
    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        gameState: newGameState,
        updatedAt: new Date(),
      },
    });

    return {
      moves,
      diceRoll,
      difficulty,
      newGameState,
    };
  }

  /**
   * Apply a single move to board state (helper function)
   */
  private applyMove(boardState: any, move: { from: number; to: number }) {
    const newBoard = JSON.parse(JSON.stringify(boardState));
    const color = boardState.currentPlayer;
    const opponentColor = color === 'white' ? 'black' : 'white';

    // Move from bar
    if (move.from === -1) {
      newBoard.bar[color]--;
      
      // ✅ Check for hit at destination
      const destPoint = newBoard.points[move.to];
      if (destPoint[opponentColor] === 1) {
        // Hit opponent checker
        destPoint[opponentColor] = 0;
        newBoard.bar[opponentColor]++;
      }
      
      newBoard.points[move.to][color]++;
    }
    // Bear off
    else if (move.to === -1 || move.to === 24) {
      newBoard.points[move.from][color]--;
      newBoard.off[color]++;
    }
    // Normal move
    else {
      newBoard.points[move.from][color]--;
      
      // ✅ Check for hit at destination
      const destPoint = newBoard.points[move.to];
      if (destPoint[opponentColor] === 1) {
        // Hit opponent checker
        destPoint[opponentColor] = 0;
        newBoard.bar[opponentColor]++;
      }
      
      newBoard.points[move.to][color]++;
    }

    return newBoard;
  }

  /**
   * Convert frontend board state format to AI service format
   */
  private convertToAIFormat(gameState: any): any {
    // Frontend format: points: Array<{ checkers: ['white', 'black', ...], count: number }>
    // AI format: points: Array<{ white: number, black: number }>
    
    const aiPoints = gameState.points.map((point: any) => {
      const whiteCount = point.checkers?.filter((c: string) => c === 'white').length || 0;
      const blackCount = point.checkers?.filter((c: string) => c === 'black').length || 0;
      
      return {
        white: whiteCount,
        black: blackCount,
      };
    });

    return {
      points: aiPoints,
      bar: gameState.bar || { white: 0, black: 0 },
      off: gameState.off || { white: 0, black: 0 },
      currentPlayer: 'black' as const,
    };
  }

  /**
   * Convert AI board state format back to frontend format
   */
  private convertFromAIFormat(aiBoard: any, originalGameState: any): any {
    // AI format: points: Array<{ white: number, black: number }>
    // Frontend format: points: Array<{ checkers: ['white', 'black', ...], count: number }>
    
    const frontendPoints = aiBoard.points.map((point: any) => {
      const checkers: string[] = [];
      
      // Add white checkers
      for (let i = 0; i < point.white; i++) {
        checkers.push('white');
      }
      
      // Add black checkers
      for (let i = 0; i < point.black; i++) {
        checkers.push('black');
      }
      
      return {
        checkers,
        count: checkers.length,
      };
    });

    return {
      ...originalGameState,
      points: frontendPoints,
      bar: aiBoard.bar,
      off: aiBoard.off,
      currentPlayer: 'white', // AI finished, player's turn
      diceValues: [], // Clear dice values
    };
  }

  private async updateUserStats(userId: string, isWin: boolean, totalSets: number) {
    const stats = await this.prisma.userStats.findUnique({
      where: { userId },
    });

    if (!stats) {
      // Create stats if not exists
      await this.prisma.userStats.create({
        data: {
          userId,
          gamesPlayed: 1,
          gamesWon: isWin ? 1 : 0,
          gamesLost: isWin ? 0 : 1,
          totalSetsWon: isWin ? totalSets : 0,
          totalSetsLost: isWin ? 0 : totalSets,
          currentStreak: isWin ? 1 : 0,
          bestStreak: isWin ? 1 : 0,
        },
      });
    } else {
      // Update existing stats
      const newStreak = isWin ? stats.currentStreak + 1 : 0;
      const newBestStreak = Math.max(stats.bestStreak, newStreak);

      await this.prisma.userStats.update({
        where: { userId },
        data: {
          gamesPlayed: { increment: 1 },
          gamesWon: { increment: isWin ? 1 : 0 },
          gamesLost: { increment: isWin ? 0 : 1 },
          totalSetsWon: { increment: isWin ? totalSets : 0 },
          totalSetsLost: { increment: isWin ? 0 : totalSets },
          currentStreak: newStreak,
          bestStreak: newBestStreak,
        },
      });
    }
  }
}
