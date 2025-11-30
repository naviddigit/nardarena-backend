import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateGameDto } from './dto/create-game.dto';
import { RecordMoveDto } from './dto/record-move.dto';
import { EndGameDto } from './dto/end-game.dto';

@Injectable()
export class GameService {
  constructor(private prisma: PrismaService) {}

  // AI Player ID (system user for AI games)
  private readonly AI_PLAYER_ID = '00000000-0000-0000-0000-000000000001';

  async createGame(userId: string, createGameDto: CreateGameDto) {
    const { gameType, opponentId, timeControl = 120, gameMode = 'CLASSIC' } = createGameDto;

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

    // Create initial empty board state
    const initialBoardState = {
      points: Array(24).fill({ white: 0, black: 0 }),
      bar: { white: 0, black: 0 },
      off: { white: 0, black: 0 },
      currentPlayer: 'white',
      phase: 'opening',
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

    return move;
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
        status: 'COMPLETED',
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
      orderBy: { endedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await this.prisma.game.count({
      where: {
        OR: [
          { whitePlayerId: userId },
          { blackPlayerId: userId },
        ],
        status: 'COMPLETED',
      },
    });

    return {
      games,
      total,
      limit,
      offset,
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
