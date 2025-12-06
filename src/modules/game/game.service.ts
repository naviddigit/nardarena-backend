/**
 * ⛔⛔⛔ CRITICAL - DO NOT MODIFY WITHOUT EXPLICIT PERMISSION! ⛔⛔⛔
 * 
 * Game Service - Core game logic and state management
 * 
 * LOCKED COMPONENTS:
 * - applyMove() - Hit logic, board manipulation
 * - validateMove() - Movement rules
 * - rollDice() - Dice generation
 * - Game state conversion and board format handling
 * 
 * This file has been tested extensively for:
 * - Hit detection and bar placement
 * - Legal move validation
 * - Board state consistency
 * - Move history tracking
 * 
 * ⚠️ Modifying these functions will break game mechanics!
 * 
 * Last stable: Dec 2, 2025
 * 
 * ===========================================
 * 📋 GAME STATE STRUCTURE (Stored in Database)
 * ===========================================
 * 
 * gameState: {
 *   // 1️⃣ نوبت فعلی - اصلی‌ترین فیلد
 *   currentPlayer: 'white' | 'black',
 *   
 *   // 2️⃣ آخرین کسی که دکمه Done زده
 *   lastDoneBy: 'white' | 'black' | null,
 *   lastDoneAt: '2025-12-04T...',  // timestamp
 *   
 *   // 3️⃣ آیا نوبت فعلی تموم شده؟
 *   turnCompleted: true | false,
 *   
 *   // 4️⃣ فاز بازی
 *   phase: 'opening' | 'waiting' | 'moving',
 *   
 *   // 5️⃣ رنگ AI (برای بازی AI)
 *   aiPlayerColor: 'white' | 'black',
 *   
 *   // 6️⃣ تاس‌ها
 *   diceValues: [3, 4],
 *   currentTurnDice: [3, 4],  // تاس فعلی (برای refresh)
 *   nextDiceRoll: [2, 5],     // تاس پیش‌ساخته برای نوبت بعد
 *   
 *   // 7️⃣ بقیه فیلدها
 *   points: [...],  // وضعیت صفحه (24 نقطه)
 *   bar: { white: 0, black: 0 },
 *   off: { white: 0, black: 0 },
 *   remainingTime: { white: 1800, black: 1800 },
 * }
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
  private readonly AI_PLAYER_ID = '00000000-0000-0000-0000-000000000001'; // AI system player

  // 🎲 Generate dice (random or specific for testing)
  private generateDice(rollOne?: number, rollTwo?: number): [number, number] {
    // If both values provided, use them (for testing)
    if (rollOne !== undefined && rollTwo !== undefined) {
      return [rollOne, rollTwo];
    }
    
    // Otherwise, generate random dice
    return [
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1,
    ];
  }

  async createGame(userId: string, createGameDto: CreateGameDto) {
    const { gameType, opponentId, timeControl = 1800, gameMode = 'CLASSIC', aiDifficulty = 'MEDIUM', aiPlayerColor = 'black' } = createGameDto;

    // ✅ Determine white and black players based on aiPlayerColor
    let whitePlayerId: string;
    let blackPlayerId: string;
    
    if (gameType === 'AI') {
      // ✅ AI color determines player assignments
      if (aiPlayerColor === 'white') {
        whitePlayerId = this.AI_PLAYER_ID;  // AI plays white
        blackPlayerId = userId;              // User plays black
      } else {
        whitePlayerId = userId;              // User plays white
        blackPlayerId = this.AI_PLAYER_ID;   // AI plays black
      }
    } else if (gameType === 'ONLINE') {
      if (!opponentId) {
        throw new BadRequestException('Opponent ID is required for ONLINE games');
      }
      whitePlayerId = userId;
      blackPlayerId = opponentId;
    } else {
      // TOURNAMENT - will be handled in tournament module
      throw new BadRequestException('Tournament games must be created through tournament system');
    }

    // Create initial standard backgammon board state
    // ✅ Using FRONTEND format: {checkers: ['white', 'white'], count: 2}
    // This way NO conversion is needed!
    const initialBoardState = {
      // Board arrangement
      points: [
        { checkers: ['black', 'black'], count: 2 },  // Point 0 - Black home (2 black)
        { checkers: [], count: 0 },  // Point 1
        { checkers: [], count: 0 },  // Point 2
        { checkers: [], count: 0 },  // Point 3
        { checkers: [], count: 0 },  // Point 4
        { checkers: ['white', 'white', 'white', 'white', 'white'], count: 5 },  // Point 5 - White (5 white)
        { checkers: [], count: 0 },  // Point 6
        { checkers: ['white', 'white', 'white'], count: 3 },  // Point 7 - White (3 white)
        { checkers: [], count: 0 },  // Point 8
        { checkers: [], count: 0 },  // Point 9
        { checkers: [], count: 0 },  // Point 10
        { checkers: ['black', 'black', 'black', 'black', 'black'], count: 5 },  // Point 11 - Black (5 black)
        { checkers: ['white', 'white', 'white', 'white', 'white'], count: 5 },  // Point 12 - White (5 white)
        { checkers: [], count: 0 },  // Point 13
        { checkers: [], count: 0 },  // Point 14
        { checkers: [], count: 0 },  // Point 15
        { checkers: ['black', 'black', 'black'], count: 3 },  // Point 16 - Black (3 black)
        { checkers: [], count: 0 },  // Point 17
        { checkers: ['black', 'black', 'black', 'black', 'black'], count: 5 },  // Point 18 - Black (5 black)
        { checkers: [], count: 0 },  // Point 19
        { checkers: [], count: 0 },  // Point 20
        { checkers: [], count: 0 },  // Point 21
        { checkers: [], count: 0 },  // Point 22
        { checkers: ['white', 'white'], count: 2 },  // Point 23 - White home (2 white)
      ],
      bar: { white: 0, black: 0 },
      off: { white: 0, black: 0 },
      
      // Turn management
      currentPlayer: 'white',
      phase: 'opening',
      
      // Dice management
      diceValues: [],
      nextDiceRoll: null, // Pre-generated dice for next turn (anti-cheat)
      currentTurnDice: null, // Current turn's dice (for refresh persistence)
      
      // Turn control - WHO pressed Done LAST?
      lastDoneBy: null, // 'white' | 'black' | null
      lastDoneAt: null, // timestamp when Done was pressed
      turnCompleted: false, // Has current player pressed Done?
      
      // Timer tracking
      remainingTime: {
        white: timeControl, // in seconds
        black: timeControl, // in seconds
      },
      
      // Game metadata
      aiDifficulty: gameType === 'AI' ? aiDifficulty : undefined,
      aiPlayerColor: gameType === 'AI' ? aiPlayerColor : undefined,
    };

    const game = await this.prisma.game.create({
      data: {
        whitePlayerId,
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

    // ✅ DON'T generate dice here! Dice should only be generated when Done is pressed (in endTurn)
    // recordMove is called MULTIPLE times (once per move), we don't want to regenerate dice each time!

    // Update boardStateAfter WITHOUT generating new dice
    const updatedBoardState = recordMoveDto.boardStateAfter 
      ? { 
          ...(recordMoveDto.boardStateAfter as any),
        }
      : game.gameState;

    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        moveHistory: {
          push: moveData,
        },
        gameState: updatedBoardState,
        updatedAt: new Date(),
      },
    });
    
    console.log('✅ Move recorded:', {
      moveNumber: recordMoveDto.moveNumber,
      from: recordMoveDto.from,
      to: recordMoveDto.to,
      gameStateUpdated: !!recordMoveDto.boardStateAfter,
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

  /**
   * 🎲 Roll dice for a game
   * ⚠️ IMPORTANT: This only RETURNS dice, does NOT save to database!
   * Database is only updated when Done button is pressed (endTurn)
   */
  async rollDiceForGame(gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const gameState = game.gameState as any;
    const currentPlayer = gameState.currentPlayer;

    // 🔒 PRIORITY 1: If turn not completed and dice exist, return SAME dice
    // This handles REFRESH scenario - user rolled but didn't press Done yet
    if (
      gameState.turnCompleted === false && 
      gameState.currentTurnDice && 
      Array.isArray(gameState.currentTurnDice) &&
      gameState.currentTurnDice.length === 2
    ) {
      console.log(`🔒 [${currentPlayer}] Turn not completed! Returning SAME dice (REFRESH):`, gameState.currentTurnDice);
      console.log(`📋 nextRoll unchanged:`, JSON.stringify(gameState.nextRoll || {}));
      
      return {
        dice: gameState.currentTurnDice,
        source: 'current-turn-refresh',
        timestamp: new Date().toISOString(),
        message: 'Returning same dice after page refresh',
      };
    }

    // 🎲 PRIORITY 2: Check if current player has nextRoll (ONLY if phase is 'waiting' AND no currentTurnDice)
    // This ensures nextRoll is used ONLY ONCE (when player first rolls after Done)
    const playerNextRoll = gameState.nextRoll?.[currentPlayer];
    if (
      gameState.phase === 'waiting' &&
      playerNextRoll && 
      Array.isArray(playerNextRoll) && 
      playerNextRoll.length === 2 &&
      (!gameState.currentTurnDice || gameState.currentTurnDice.length === 0)
    ) {
      console.log(`🎲 [${currentPlayer}] Using nextRoll (FIRST ROLL after Done):`, playerNextRoll);
      console.log(`📋 nextRoll BEFORE use:`, JSON.stringify(gameState.nextRoll));
      
      const dice = playerNextRoll;
      
      // ✅ CRITICAL: Save currentTurnDice so refresh returns same dice!
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          gameState: {
            ...gameState,
            currentTurnDice: dice,
            turnCompleted: false,
          },
        },
      });
      
      console.log(`✅ [${currentPlayer}] Dice locked as currentTurnDice for refresh protection`);
      
      return {
        dice,
        source: 'nextRoll',
        timestamp: new Date().toISOString(),
        message: 'Dice rolled - press Done to save',
      };
    }
    
    // 🎲 PRIORITY 2.5: Check nextDiceRoll (compatibility with old system)
    else if (gameState.nextDiceRoll && Array.isArray(gameState.nextDiceRoll) && gameState.nextDiceRoll.length === 2) {
      console.log(`🎲 [${currentPlayer}] Using nextDiceRoll:`, gameState.nextDiceRoll);
      
      const dice = gameState.nextDiceRoll as [number, number];
      
      // ✅ CRITICAL: NO DATABASE UPDATE - only return dice!
      console.log(`⚠️ NO DATABASE UPDATE - Only returning dice to frontend`);
      
      return {
        dice,
        source: 'nextDiceRoll',
        timestamp: new Date().toISOString(),
        message: 'Dice rolled - press Done to save',
      };
    }
    
    else {
      // 🆕 FALLBACK: Generate new dice (for opening phase or first turn)
      const dice = this.generateDice();
      console.log(`🎲 [${currentPlayer}] No nextRoll/nextDiceRoll found, generating new:`, dice);
      console.log(`📋 nextRoll:`, JSON.stringify(gameState.nextRoll || {}));
      console.log(`📋 nextDiceRoll:`, JSON.stringify(gameState.nextDiceRoll || null));

      // ✅ CRITICAL: NO DATABASE UPDATE - only return dice!
      console.log(`⚠️ NO DATABASE UPDATE - Only returning dice to frontend`);

      return {
        dice,
        source: 'generated',
        timestamp: new Date().toISOString(),
        message: 'Dice rolled - press Done to save',
      };
    }
  }

  /**
   * ✅ End Turn (Done button pressed)
   * - Mark turn as completed
   * - Switch currentPlayer
   * - Generate dice for next turn
   */
  async endTurn(gameId: string, userId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Verify user is a player
    if (game.whitePlayerId !== userId && game.blackPlayerId !== userId) {
      throw new ForbiddenException('Not a player in this game');
    }

    const gameState = game.gameState as any;
    const currentPlayer = gameState.currentPlayer;

    // Verify it's this player's turn
    const isWhitePlayer = game.whitePlayerId === userId;
    const playerColor = isWhitePlayer ? 'white' : 'black';
    
    if (currentPlayer !== playerColor) {
      throw new BadRequestException('Not your turn');
    }

    console.log(`✅ [${playerColor}] pressed Done - ending turn`);

    // Switch player
    const nextPlayer = currentPlayer === 'white' ? 'black' : 'white';
    
    // ✅ ALWAYS generate dice for next player (whoever's turn is next gets dice)
    let nextPlayerDice: [number, number];
    
    if (gameState.nextDiceRoll && Array.isArray(gameState.nextDiceRoll) && gameState.nextDiceRoll.length === 2) {
      // ✅ Use existing nextDiceRoll - DON'T generate new!
      nextPlayerDice = gameState.nextDiceRoll as [number, number];
      console.log(`🔒 [${playerColor}] Done pressed - Using nextDiceRoll for ${nextPlayer}:`, nextPlayerDice);
    } else {
      // ✅ Generate new dice
      nextPlayerDice = this.generateDice();
      console.log(`🎲 [${playerColor}] Done pressed - Generating NEW dice for ${nextPlayer}:`, nextPlayerDice);
    }

    // ✅ CRITICAL: nextRoll should have dice for NEXT player, NOT current player!
    // If white pressed Done → nextPlayer is black → black gets dice
    // If black pressed Done → nextPlayer is white → white gets dice
    const updatedNextRoll = {
      white: nextPlayer === 'white' ? nextPlayerDice : null,
      black: nextPlayer === 'black' ? nextPlayerDice : null,
    };

    console.log(`📋 nextRoll:`, JSON.stringify(updatedNextRoll));

    const updatedGameState = {
      ...gameState,
      currentPlayer: nextPlayer,
      
      // ✅ Track WHO pressed Done and WHEN
      lastDoneBy: playerColor,
      lastDoneAt: new Date().toISOString(),
      turnCompleted: true, // ✅ Mark as completed
      
      phase: 'waiting', // Back to waiting for next roll
      currentTurnDice: gameState.diceValues || gameState.currentTurnDice, // ✅ Save current dice before clearing
      diceValues: [], // Clear current dice
      nextRoll: updatedNextRoll, // ✅ ONLY this field for dice
      nextDiceRoll: nextPlayerDice, // ✅ ALSO save to nextDiceRoll for compatibility (null if AI is next)
    };

    const updatedGame = await this.prisma.game.update({
      where: { id: gameId },
      data: {
        gameState: updatedGameState,
        updatedAt: new Date(),
      },
      include: {
        whitePlayer: true,
        blackPlayer: true,
        moves: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return {
      message: 'Turn ended successfully',
      nextPlayer,
      nextRoll: updatedNextRoll, // ✅ ONLY this field
      game: {
        id: updatedGame.id,
        gameState: updatedGame.gameState,
        status: updatedGame.status,
      },
    };
  }

  /**
   * ✅ Check if user can play
   * Returns: can they roll dice? or is it opponent's turn and they haven't finished?
   */
  async canUserPlay(gameId: string, userId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Verify user is a player
    if (game.whitePlayerId !== userId && game.blackPlayerId !== userId) {
      throw new ForbiddenException('Not a player in this game');
    }

    const gameState = game.gameState as any;
    const currentPlayer = gameState.currentPlayer;
    const turnCompleted = gameState.turnCompleted !== false; // Default true if not set
    
    // 📋 Log complete gameState structure
    console.log('🎮 gameState:', {
      currentPlayer: gameState.currentPlayer,
      lastDoneBy: gameState.lastDoneBy || null,
      lastDoneAt: gameState.lastDoneAt || null,
      turnCompleted: gameState.turnCompleted !== false,
      phase: gameState.phase || 'waiting',
      aiPlayerColor: gameState.aiPlayerColor || null,
      diceValues: gameState.diceValues || null,
      currentTurnDice: gameState.currentTurnDice || null,
      nextDiceRoll: gameState.nextDiceRoll || null,
    });
    
    // Determine user's color
    const isWhitePlayer = game.whitePlayerId === userId;
    const playerColor = isWhitePlayer ? 'white' : 'black';
    
    // Check if it's user's turn
    const isUserTurn = currentPlayer === playerColor;
    
    // ✅ CRITICAL LOGIC:
    // - canPlay = TRUE if it's your turn (whether completed or not!)
    // - canRollNewDice = TRUE only if it's your turn AND previous turn completed
    // - If turnCompleted = false, you can CONTINUE playing but can't roll NEW dice
    // - EXCEPTION: In opening phase, always allow rolling
    
    const phase = gameState.phase || 'waiting';
    const canPlay = isUserTurn; // ✅ Can play if it's your turn
    const canRollNewDice = phase === 'opening' ? isUserTurn : (isUserTurn && turnCompleted); // ✅ Opening phase: always allow, Normal: only if Done was pressed
    
    // ✅ Enhanced response with lastDoneBy info
    return {
      canPlay, // ✅ Can interact with board
      canRollNewDice, // ✅ Can request new dice (not restore old ones)
      isYourTurn: isUserTurn,
      turnCompleted,
      currentPlayer,
      playerColor,
      phase,
      
      // ✅ NEW: Who pressed Done last?
      lastDoneBy: gameState.lastDoneBy || null,
      lastDoneAt: gameState.lastDoneAt || null,
      
      // ✅ Dice info
      currentTurnDice: gameState.currentTurnDice || null,
      nextDiceRoll: gameState.nextDiceRoll || null,
      
      message: !isUserTurn 
        ? `It's ${currentPlayer}'s turn${!turnCompleted ? ' (they haven\'t finished yet)' : ''}`
        : !turnCompleted
          ? 'Continue your turn (restore dice from refresh)'
          : 'Your turn - you can roll dice',
    };
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

    // 🔍 DEBUG: Log nextRoll from database
    console.log('🔍 [getGame] Reading from database:');
    console.log('  gameId:', gameId);
    console.log('  nextRoll:', JSON.stringify((game.gameState as any)?.nextRoll));
    console.log('  nextDiceRoll:', JSON.stringify((game.gameState as any)?.nextDiceRoll));
    console.log('  currentTurnDice:', JSON.stringify((game.gameState as any)?.currentTurnDice));

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
   * Get user game statistics
   */
  async getUserStats(userId: string) {
    // Get all games (both ACTIVE and COMPLETED) for this user, ordered by creation date
    const games = await this.prisma.game.findMany({
      where: {
        OR: [
          { whitePlayerId: userId },
          { blackPlayerId: userId },
        ],
        status: {
          in: ['ACTIVE', 'COMPLETED'],
        },
      },
      select: {
        id: true,
        winner: true,
        whitePlayerId: true,
        blackPlayerId: true,
        whiteSetsWon: true,
        blackSetsWon: true,
        createdAt: true,
        endedAt: true,
        status: true,
      },
      orderBy: {
        createdAt: 'asc', // Order by creation time for streak calculation
      },
    });

    const gamesPlayed = games.length;
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let activeGames = 0;
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;
    let lastGameWasWin = false;

    games.forEach((game) => {
      if (game.status === 'ACTIVE') {
        activeGames++;
      } else if (!game.winner) {
        draws++;
        tempStreak = 0; // Draw breaks streak
        lastGameWasWin = false;
      } else {
        const isWhitePlayer = game.whitePlayerId === userId;
        const userWon = 
          (isWhitePlayer && game.winner === 'WHITE') ||
          (!isWhitePlayer && game.winner === 'BLACK');
        
        if (userWon) {
          wins++;
          tempStreak++;
          lastGameWasWin = true;
          if (tempStreak > bestStreak) {
            bestStreak = tempStreak;
          }
        } else {
          losses++;
          tempStreak = 0; // Loss breaks streak
          lastGameWasWin = false;
        }
      }
    });

    // Current streak is the temp streak if last game was a win
    currentStreak = lastGameWasWin ? tempStreak : 0;

    const completedGames = gamesPlayed - activeGames;
    const winRate = completedGames > 0 ? (wins / completedGames) * 100 : 0;

    return {
      gamesPlayed,
      wins,
      losses,
      draws,
      activeGames,
      completedGames,
      winRate: Math.round(winRate * 10) / 10, // Round to 1 decimal
      totalEarnings: 0, // TODO: Implement when wallet integration is done
      totalLosses: 0,
      netProfit: 0,
      bestStreak,
      currentStreak,
      averageGameDuration: 0, // TODO: Calculate from createdAt/endedAt
      lastGameAt: games.length > 0 ? (games[games.length - 1].endedAt || games[games.length - 1].createdAt) : null,
    };
  }

  /**
   * Get monthly game statistics
   */
  async getMonthlyStats(userId: string, year: number, month: number) {
    // Get start and end of month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Get games in this month
    const games = await this.prisma.game.findMany({
      where: {
        OR: [
          { whitePlayerId: userId },
          { blackPlayerId: userId },
        ],
        status: 'COMPLETED',
        endedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        winner: true,
        whitePlayerId: true,
        blackPlayerId: true,
      },
    });

    const gamesPlayed = games.length;
    let wins = 0;

    games.forEach((game) => {
      if (game.winner) {
        const isWhitePlayer = game.whitePlayerId === userId;
        const userWon = 
          (isWhitePlayer && game.winner === 'WHITE') ||
          (!isWhitePlayer && game.winner === 'BLACK');
        
        if (userWon) {
          wins++;
        }
      }
    });

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    return {
      month: monthNames[month - 1],
      year,
      gamesPlayed,
      wins,
      earnings: 0, // TODO: Implement when wallet integration is done
      deposited: 0,
      withdrawn: 0,
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
   * Update game state directly (for opening roll, phase changes, etc.)
   */
  async updateGameState(gameId: string, userId: string, newGameState: any) {
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

    // Update game state without creating a move
    const updatedGame = await this.prisma.game.update({
      where: { id: gameId },
      data: {
        gameState: newGameState,
        updatedAt: new Date(),
      },
      include: {
        whitePlayer: true,
        blackPlayer: true,
        moves: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    console.log('✅ Game state updated (no move created)');

    return {
      id: updatedGame.id,
      whitePlayerId: updatedGame.whitePlayerId,
      blackPlayerId: updatedGame.blackPlayerId,
      gameType: updatedGame.gameType,
      status: updatedGame.status,
      gameState: updatedGame.gameState,
      timeControl: updatedGame.timeControl,
      moves: updatedGame.moves,
      createdAt: updatedGame.createdAt,
      updatedAt: updatedGame.updatedAt,
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
    
    console.log('🔍 AI makeMove - gameState dice check:', {
      nextDiceRoll: gameState.nextDiceRoll,
      diceValues: gameState.diceValues,
      currentTurnDice: gameState.currentTurnDice,
    });
    
    // ✅ Determine AI color from player IDs (AI_PLAYER_ID = white or black)
    const isWhiteAI = game.whitePlayerId === this.AI_PLAYER_ID;
    const isBlackAI = game.blackPlayerId === this.AI_PLAYER_ID;
    const aiColor = isWhiteAI ? 'white' : 'black';
    const currentPlayer = (gameState.currentPlayer || 'white').toLowerCase();
    
    console.log('🔍 Checking AI turn:', {
      currentPlayer,
      aiColor,
      whitePlayerId: game.whitePlayerId,
      blackPlayerId: game.blackPlayerId,
      AI_PLAYER_ID: this.AI_PLAYER_ID,
    });
    
    // Check if it's AI's turn (case-insensitive)
    if (currentPlayer !== aiColor) {
      throw new BadRequestException(`Not AI turn - current: ${currentPlayer}, AI: ${aiColor}`);
    }

    // ✅ CRITICAL: Determine dice roll ONCE and save to database IMMEDIATELY
    let diceRoll: [number, number];
    
    // PRIORITY 1: If currentTurnDice exists and matches current player, use it (already locked in)
    if (gameState.currentTurnDice && gameState.currentTurnDice.length >= 2 && 
        gameState.lastDoneBy !== aiColor) {
      // This means AI already has locked dice from previous attempt
      diceRoll = [gameState.currentTurnDice[0], gameState.currentTurnDice[1]];
      console.log('🔒 AI using LOCKED dice (currentTurnDice):', diceRoll);
    }
    // PRIORITY 2: Use nextDiceRoll (pre-generated when opponent pressed Done)
    else if (gameState.nextDiceRoll && gameState.nextDiceRoll.length >= 2) {
      diceRoll = [gameState.nextDiceRoll[0], gameState.nextDiceRoll[1]];
      console.log('🎲 AI using pre-generated dice (nextDiceRoll):', diceRoll);
      
      // ✅ LOCK IT IMMEDIATELY in database before doing anything else
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          gameState: {
            ...gameState,
            currentTurnDice: diceRoll,
            diceValues: diceRoll,
            phase: 'moving',
          },
        },
      });
      console.log('🔒 Dice LOCKED in database:', diceRoll);
    }
    // PRIORITY 3: Use existing diceValues
    else if (gameState.diceValues && gameState.diceValues.length >= 2) {
      diceRoll = [gameState.diceValues[0], gameState.diceValues[1]];
      console.log('🎲 AI using existing diceValues:', diceRoll);
    }
    // PRIORITY 4: ERROR - Should never reach here
    else {
      throw new BadRequestException('No dice available for AI - this should not happen!');
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
    let moveNumber = 1;
    
    // ✅ Get current move count from database
    const existingMoves = await this.prisma.gameMove.findMany({
      where: { gameId },
      select: { moveNumber: true },
      orderBy: { moveNumber: 'desc' },
      take: 1,
    });
    
    if (existingMoves.length > 0) {
      moveNumber = existingMoves[0].moveNumber + 1;
    }
    
    for (const move of moves) {
      const boardBefore = JSON.parse(JSON.stringify(currentBoard));
      currentBoard = this.applyMove(currentBoard, move);
      const boardAfter = JSON.parse(JSON.stringify(currentBoard));
      
      // ✅ Record each AI move in database
      await this.prisma.gameMove.create({
        data: {
          gameId,
          playerColor: aiColor.toUpperCase() as 'WHITE' | 'BLACK',
          moveNumber,
          from: move.from,
          to: move.to,
          diceUsed: Math.abs(move.to - move.from),
          isHit: false,
          boardStateBefore: boardBefore,
          boardStateAfter: boardAfter,
          timeRemaining: 0,
          moveTime: 0,
        },
      });
      
      moveNumber++;
    }

    // Convert back to frontend format
    const newGameState = this.convertFromAIFormat(currentBoard, gameState);
    
    // ✅ Switch turn to human player after AI moves
    const humanPlayerColor = aiColor === 'white' ? 'black' : 'white';
    newGameState.currentPlayer = humanPlayerColor;
    newGameState.currentTurnDice = diceRoll; // ✅ Save AI's dice before clearing
    newGameState.diceValues = [];
    newGameState.phase = 'waiting';
    
    // ✅ Mark turn as completed (AI finished its turn)
    newGameState.turnCompleted = true;
    newGameState.lastDoneBy = aiColor;
    newGameState.lastDoneAt = new Date().toISOString();

    // 🎲 AI Done → Generate dice for human player (same as endTurn does)
    const nextDiceRoll = this.generateDice();
    newGameState.nextDiceRoll = nextDiceRoll;
    
    // ✅ Set nextRoll for human player
    newGameState.nextRoll = {
      white: humanPlayerColor === 'white' ? nextDiceRoll : null,
      black: humanPlayerColor === 'black' ? nextDiceRoll : null,
    };
    
    console.log('🎲 AI Done - Generated dice for human player:', nextDiceRoll);
    console.log('📋 nextRoll:', JSON.stringify(newGameState.nextRoll));

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

    // ✅ Ensure bar and off objects exist (prevent undefined errors)
    if (!newBoard.bar) {
      newBoard.bar = { white: 0, black: 0 };
    }
    if (!newBoard.off) {
      newBoard.off = { white: 0, black: 0 };
    }

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
      currentPlayer: gameState.currentPlayer || 'black',
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

  /**
   * Get leaderboard with rankings
   */
  async getLeaderboard(
    period: 'weekly' | 'monthly' | 'all-time' = 'weekly',
    limit: number = 10,
  ) {
    let dateFilter: any = {};

    if (period === 'weekly') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = { createdAt: { gte: weekAgo } };
    } else if (period === 'monthly') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateFilter = { createdAt: { gte: monthAgo } };
    }

    // Get all completed games in the period
    const games = await this.prisma.game.findMany({
      where: {
        status: 'COMPLETED',
        ...dateFilter,
      },
      include: {
        whitePlayer: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        blackPlayer: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // Calculate stats for each user
    const userStatsMap = new Map<
      string,
      {
        userId: string;
        username: string;
        avatar?: string | null;
        wins: number;
        losses: number;
        draws: number;
        gamesPlayed: number;
        totalEarnings: number;
      }
    >();

    games.forEach((game) => {
      // Process white player
      if (game.whitePlayer) {
        const userId = game.whitePlayer.id;
        if (!userStatsMap.has(userId)) {
          userStatsMap.set(userId, {
            userId,
            username: game.whitePlayer.username,
            avatar: game.whitePlayer.avatar,
            wins: 0,
            losses: 0,
            draws: 0,
            gamesPlayed: 0,
            totalEarnings: 0,
          });
        }
        const stats = userStatsMap.get(userId)!;
        stats.gamesPlayed++;
        if (game.winner === 'WHITE') {
          stats.wins++;
          stats.totalEarnings += Number(game.betAmount || 0);
        } else if (game.winner === 'BLACK') {
          stats.losses++;
        } else {
          stats.draws++;
        }
      }

      // Process black player
      if (game.blackPlayer) {
        const userId = game.blackPlayer.id;
        if (!userStatsMap.has(userId)) {
          userStatsMap.set(userId, {
            userId,
            username: game.blackPlayer.username,
            avatar: game.blackPlayer.avatar,
            wins: 0,
            losses: 0,
            draws: 0,
            gamesPlayed: 0,
            totalEarnings: 0,
          });
        }
        const stats = userStatsMap.get(userId)!;
        stats.gamesPlayed++;
        if (game.winner === 'BLACK') {
          stats.wins++;
          stats.totalEarnings += Number(game.betAmount || 0);
        } else if (game.winner === 'WHITE') {
          stats.losses++;
        } else {
          stats.draws++;
        }
      }
    });

    // Convert to array and calculate rankings
    const leaderboard = Array.from(userStatsMap.values())
      .filter((user) => user.gamesPlayed > 0)
      .map((user) => {
        const winRate = user.gamesPlayed > 0 ? (user.wins / user.gamesPlayed) * 100 : 0;
        // Points calculation: wins * 3 + winRate
        const points = user.wins * 3 + winRate;

        return {
          ...user,
          winRate: parseFloat(winRate.toFixed(2)),
          points: parseFloat(points.toFixed(2)),
        };
      })
      .sort((a, b) => b.points - a.points)
      .slice(0, limit)
      .map((user, index) => ({
        rank: index + 1,
        ...user,
      }));

    return {
      leaderboard,
      total: leaderboard.length,
      period,
    };
  }

  // ==========================================
  // 🔐 ANTI-CHEAT: Winner First Dice System
  // ==========================================

  /**
   * Generate first dice for opening roll winner
   * This is called ONCE after opening roll completes
   * Prevents refresh-to-get-better-dice exploit
   * 
   * ✅ NEW: Stores in nextRoll.{winner} instead of firstDiceRoll
   */
  /**
   * ⛔⛔⛔ CRITICAL - DO NOT MODIFY! ⛔⛔⛔
   * 
   * Complete opening roll and generate dice for winner
   * 
   * 🔒 LOCKED - December 6, 2025
   * ⚠️ Modification without permission = project removal
   */
  async completeOpeningRoll(gameId: string, winner: 'white' | 'black') {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const gameState = game.gameState as any;

    // ✅ ALWAYS generate dice for winner (like opponent pressed Done for them)
    const nextPlayerDice = this.generateDice();
    console.log(`🎲 [Opening] Generating dice for winner ${winner}:`, nextPlayerDice);

    const updatedNextRoll = {
      white: winner === 'white' ? nextPlayerDice : null,
      black: winner === 'black' ? nextPlayerDice : null,
    };

    console.log(`📋 nextRoll:`, JSON.stringify(updatedNextRoll));

    const updatedGameState = {
      ...gameState,
      currentPlayer: winner,
      phase: 'waiting',
      turnCompleted: true,
      nextRoll: updatedNextRoll,
      nextDiceRoll: nextPlayerDice,
      diceValues: [],
    };

    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        gameState: updatedGameState,
        updatedAt: new Date(),
      },
    });

    return {
      message: 'Opening roll completed',
      winner,
      nextRoll: updatedNextRoll,
    };
  }

  /**
   * Clear first dice when turn ends
   * Next player will get their own fresh dice
   * ⚠️ DEPRECATED: This function is no longer used
   */
  async clearFirstDice(gameId: string): Promise<void> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const gameState = game.gameState as any;

    // Only update if firstDiceRoll exists
    if (gameState.firstDiceRoll) {
      console.log('🧹 Clearing first dice');
      
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          gameState: {
            ...gameState,
            firstDiceRoll: null,
          },
        },
      });
    }
  }
}
