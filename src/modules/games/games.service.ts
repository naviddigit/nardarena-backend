import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

/**
 * Games Service
 * Manages game creation, state, and logic
 * 
 * SOLID Principles:
 * - Single Responsibility: Only game management
 * - Open/Closed: Extensible for new game modes
 * - Dependency Inversion: Depends on PrismaService abstraction
 */
@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create new game
   */
  async createGame(whitePlayerId: string, blackPlayerId: string) {
    const initialState = this.getInitialGameState();

    const game = await this.prisma.game.create({
      data: {
        whitePlayerId,
        blackPlayerId,
        gameState: initialState as any,
        moveHistory: [],
        status: 'ACTIVE',
        startedAt: new Date(),
      },
      include: {
        whitePlayer: {
          select: { id: true, username: true, displayName: true },
        },
        blackPlayer: {
          select: { id: true, username: true, displayName: true },
        },
      },
    });

    this.logger.log(`Game created: ${game.id}`);
    return game;
  }

  /**
   * Get game by ID
   */
  async getGame(gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        whitePlayer: {
          select: { id: true, username: true, displayName: true },
        },
        blackPlayer: {
          select: { id: true, username: true, displayName: true },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    return game;
  }

  /**
   * Get initial game state (backgammon starting position)
   */
  private getInitialGameState() {
    return {
      board: this.getInitialBoard(),
      currentPlayer: 'WHITE',
      diceValues: [],
      gamePhase: 'opening',
      whiteBar: 0,
      blackBar: 0,
      whiteHome: 0,
      blackHome: 15,
    };
  }

  /**
   * Get initial backgammon board setup
   * Points 1-24, each point has { color, count }
   */
  private getInitialBoard() {
    // Standard backgammon starting position
    const board = Array(24).fill({ color: null, count: 0 });

    // White pieces
    board[0] = { color: 'WHITE', count: 2 };  // Point 1
    board[11] = { color: 'WHITE', count: 5 }; // Point 12
    board[16] = { color: 'WHITE', count: 3 }; // Point 17
    board[18] = { color: 'WHITE', count: 5 }; // Point 19

    // Black pieces
    board[23] = { color: 'BLACK', count: 2 };  // Point 24
    board[12] = { color: 'BLACK', count: 5 };  // Point 13
    board[7] = { color: 'BLACK', count: 3 };   // Point 8
    board[5] = { color: 'BLACK', count: 5 };   // Point 6

    return board;
  }

  /**
   * Update game state after move
   */
  async updateGameState(gameId: string, newState: any, move: any) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: { moveHistory: true },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const moveHistory = [...(game.moveHistory as any[]), move];

    return this.prisma.game.update({
      where: { id: gameId },
      data: {
        gameState: newState as any,
        moveHistory: moveHistory as any,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * End game
   */
  async endGame(gameId: string, winner: 'WHITE' | 'BLACK', reason: string) {
    const game = await this.getGame(gameId);

    // Update game
    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        status: 'COMPLETED',
        winner,
        endReason: reason as any,
        endedAt: new Date(),
      },
    });

    // Update user stats
    const winnerId = winner === 'WHITE' ? game.whitePlayerId : game.blackPlayerId;
    const loserId = winner === 'WHITE' ? game.blackPlayerId : game.whitePlayerId;

    await this.updateUserStats(winnerId, true);
    await this.updateUserStats(loserId, false);

    this.logger.log(`Game ended: ${gameId}, Winner: ${winner}`);
  }

  /**
   * Update user statistics after game
   */
  private async updateUserStats(userId: string, won: boolean) {
    const stats = await this.prisma.userStats.findUnique({
      where: { userId },
    });

    if (!stats) return;

    await this.prisma.userStats.update({
      where: { userId },
      data: {
        gamesPlayed: { increment: 1 },
        gamesWon: won ? { increment: 1 } : undefined,
        gamesLost: !won ? { increment: 1 } : undefined,
        currentStreak: won ? { increment: 1 } : 0,
        bestStreak: won && stats.currentStreak + 1 > stats.bestStreak
          ? stats.currentStreak + 1
          : undefined,
      },
    });
  }
}
