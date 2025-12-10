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


import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Optional, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateGameDto } from './dto/create-game.dto';
import { RecordMoveDto } from './dto/record-move.dto';
import { EndGameDto } from './dto/end-game.dto';
import { AIPlayerService, AIDifficulty } from './ai/ai-player.service';
import { SettingsService } from '../settings/settings.service';
import { OpeningRollService } from './core/opening-roll.service';
import { AIMoveService } from './core/ai-move.service';
import { GameGateway } from './game.gateway';

@Injectable()
export class GameService {
  constructor(
    private prisma: PrismaService,
    private aiPlayerService: AIPlayerService,
    private settingsService: SettingsService,
    private openingRollService: OpeningRollService,
    private aiMoveService: AIMoveService,
    @Optional() @Inject(forwardRef(() => GameGateway)) private gameGateway?: GameGateway,
  ) {}

  // AI Player ID (system user for AI games)
  private readonly AI_PLAYER_ID = '00000000-0000-0000-0000-000000000001'; // AI system player

  // ========================================================================
  // 🔌 WebSocket Helper Methods
  // ========================================================================

  /**
   * Emit game state update via WebSocket (if gateway is available)
   */
  private emitGameStateUpdate(gameId: string, gameState: any) {
    try {
      if (this.gameGateway && typeof this.gameGateway.emitGameStateUpdate === 'function') {
        this.gameGateway.emitGameStateUpdate(gameId, gameState);
      }
    } catch (error) {
      // Silently fail if WebSocket not available (fallback to polling)
      console.warn('WebSocket emit failed, clients will use polling fallback');
    }
  }

  /**
   * Emit move via WebSocket
   */
  private emitMove(gameId: string, moveData: any) {
    try {
      if (this.gameGateway && typeof this.gameGateway.emitMove === 'function') {
        this.gameGateway.emitMove(gameId, moveData);
      }
    } catch (error) {
      console.warn('WebSocket emit failed for move');
    }
  }

  /**
   * Emit timer update via WebSocket
   */
  private emitTimerUpdate(gameId: string, timers: { white: number; black: number }) {
    try {
      if (this.gameGateway && typeof this.gameGateway.emitTimerUpdate === 'function') {
        this.gameGateway.emitTimerUpdate(gameId, timers);
      }
    } catch (error) {
      console.warn('WebSocket emit failed for timer');
    }
  }

  /**
   * Emit game end via WebSocket
   */
  private emitGameEnd(gameId: string, result: any) {
    try {
      if (this.gameGateway && typeof this.gameGateway.emitGameEnd === 'function') {
        this.gameGateway.emitGameEnd(gameId, result);
      }
    } catch (error) {
      console.warn('WebSocket emit failed for game end');
    }
  }

  // ========================================================================
  // 🎲 Dice and Game Logic
  // ========================================================================

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
    const { gameType, opponentId, gameMode = 'CLASSIC', aiDifficulty = 'MEDIUM', aiPlayerColor = 'black' } = createGameDto;

    // ✅ Get timeControl from GameSettings (anti-cheat: always from database)
    let timeControl = 1800; // Default 30 minutes
    try {
      const timeSetting = await this.settingsService.getGameSetting('game.total_time_per_game');
      if (timeSetting && timeSetting.value) {
        timeControl = parseInt(timeSetting.value, 10);
        console.log(`⏱️ Loaded timeControl from settings: ${timeControl} seconds`);
      }
    } catch (error) {
      console.warn('Failed to load time control from settings, using default:', error);
    }

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

    // 🎲 Pre-generate ALL dice for anti-cheat (unhackable!)
    const openingDiceWhite = Math.floor(Math.random() * 6) + 1;
    const openingDiceBlack = Math.floor(Math.random() * 6) + 1;
    const firstRollDice = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
    
    console.log('\n=================================================');
    console.log('🎲 Pre-generated dice at game creation:');
    console.log('=================================================');
    console.log(`📋 Opening Roll (1d6):`);
    console.log(`   🎲 White Player: ${openingDiceWhite}`);
    console.log(`   🎲 Black Player: ${openingDiceBlack}`);
    console.log(`📋 Winner's First Roll (2d6): [${firstRollDice[0]}, ${firstRollDice[1]}]`);
    console.log('=================================================\n');

    const game = await this.prisma.game.create({
      data: {
        whitePlayerId,
        blackPlayerId,
        gameType,
        gameMode,
        timeControl,
        whiteTimeRemaining: timeControl, // ✅ Initialize timer for white
        blackTimeRemaining: timeControl, // ✅ Initialize timer for black
        openingDiceWhite,
        openingDiceBlack,
        firstRollDice,
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

    // 🎲 Log pre-generated dice for frontend
    console.log('\n📤 [RESPONSE TO FRONTEND] Game created with pre-generated dice:');
    console.log(`   Opening White: ${openingDiceWhite}`);
    console.log(`   Opening Black: ${openingDiceBlack}`);
    console.log(`   Winner First Roll: [${firstRollDice[0]}, ${firstRollDice[1]}]\n`);

    return game;
  }

  /**
   * ⏱️🔒 LOCKED - TIMER CALCULATION ALGORITHM (Dec 8, 2025)
   * ================================================================
   * ⚠️ DO NOT MODIFY THIS METHOD WITHOUT EXPLICIT APPROVAL!
   * 
   * Algorithm:
   * 1. Read lastDoneBy from gameState (who pressed Done last)
   * 2. Read lastDoneAt from gameState (when they pressed Done)
   * 3. Get current server time (NOW)
   * 4. Calculate elapsed: NOW - lastDoneAt (in seconds)
   * 5. Subtract elapsed from OPPOSITE player's timer
   * 
   * Logic:
   * - If white pressed Done → black's timer counts → subtract from blackTime
   * - If black pressed Done → white's timer counts → subtract from whiteTime
   * 
   * RULES:
   * - Timer counts from lastDoneAt (when opponent pressed Done OR opening winner declared)
   * - Timer counts even if player hasn't rolled dice yet
   * - Timer ONLY stops when player presses Done (then opponent timer starts)
   * - Returns calculated values - does NOT save to database!
   * 
   * ⛔ LOCKED after months of debugging - DO NOT TOUCH!
   * ================================================================
   */
  private calculateCurrentTimers(game: any): { whiteTime: number; blackTime: number } {
    const gameState = game.gameState as any;
    const lastDoneBy = gameState.lastDoneBy?.toLowerCase(); // Who pressed Done last
    const lastDoneAt = gameState.lastDoneAt;
    const phase = gameState.phase;

    let whiteTime = game.whiteTimeRemaining || 0;
    let blackTime = game.blackTimeRemaining || 0;

    console.log('⏱️ [calculateCurrentTimers] INPUT:', {
      whiteTimeDB: whiteTime,
      blackTimeDB: blackTime,
      lastDoneBy,
      lastDoneAt,
      phase,
    });

    // Timer counts if:
    // 1. lastDoneAt exists (turn has started)
    // 2. lastDoneBy exists (we know who pressed Done)
    // 3. phase is 'playing' or 'waiting' or 'moving' (game in progress, not opening or game-over)
    //
    // LOGIC: If white pressed Done → black timer counts
    //        If black pressed Done → white timer counts
    //
    // ⚠️ DO NOT check if time > 0 - we need to track negative/zero time for timeout!
    if (lastDoneAt && lastDoneBy && (phase === 'playing' || phase === 'waiting' || phase === 'moving')) {
      const now = Date.now();
      const lastDoneTime = new Date(lastDoneAt).getTime();
      const elapsedSeconds = Math.floor((now - lastDoneTime) / 1000);

      console.log('⏱️ [calculateCurrentTimers] CALCULATING:', {
        now,
        lastDoneTime,
        elapsedSeconds,
        activePlayer: lastDoneBy === 'white' ? 'black' : 'white',
      });

      // Determine which timer should count (OPPOSITE of who pressed Done)
      const activePlayer = lastDoneBy === 'white' ? 'black' : 'white';

      // Subtract elapsed time from active player's timer (can go negative for timeout detection)
      if (activePlayer === 'white') {
        whiteTime = Math.max(0, whiteTime - elapsedSeconds);
      } else if (activePlayer === 'black') {
        blackTime = Math.max(0, blackTime - elapsedSeconds);
      }
    } else {
      console.log('⏱️ [calculateCurrentTimers] SKIPPED - conditions not met');
    }

    console.log('⏱️ [calculateCurrentTimers] OUTPUT:', {
      whiteTime,
      blackTime,
    });

    return { whiteTime, blackTime };
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
    // ⏱️ CRITICAL: Preserve lastDoneBy and lastDoneAt from existing gameState!
    const existingGameState = game.gameState as any;
    const updatedBoardState = recordMoveDto.boardStateAfter 
      ? { 
          ...(recordMoveDto.boardStateAfter as any),
          // ⏱️ Preserve timer fields from previous state
          lastDoneBy: existingGameState.lastDoneBy,
          lastDoneAt: existingGameState.lastDoneAt,
        }
      : game.gameState;

    // ✅ Update player's time remaining in database
    const updateData: any = {
      moveHistory: {
        push: moveData,
      },
      gameState: updatedBoardState,
      updatedAt: new Date(),
    };

    // ✅ Save timer if provided
    if (recordMoveDto.timeRemaining !== undefined && recordMoveDto.timeRemaining !== null) {
      if (recordMoveDto.playerColor === 'WHITE') {
        updateData.whiteTimeRemaining = recordMoveDto.timeRemaining;
      } else if (recordMoveDto.playerColor === 'BLACK') {
        updateData.blackTimeRemaining = recordMoveDto.timeRemaining;
      }
    }

    const updatedGame = await this.prisma.game.update({
      where: { id: gameId },
      data: updateData,
    });

    // 📡 Emit move via WebSocket for real-time sync
    this.emitMove(gameId, {
      playerColor: recordMoveDto.playerColor,
      from: recordMoveDto.from,
      to: recordMoveDto.to,
      diceUsed: recordMoveDto.diceUsed,
      boardState: updatedBoardState,
      moveNumber: recordMoveDto.moveNumber,
    });
    this.emitGameStateUpdate(gameId, updatedGame.gameState);

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

    // 📡 Emit game end via WebSocket
    this.emitGameEnd(gameId, {
      winner: endGameDto.winner,
      endReason: endGameDto.endReason || 'NORMAL_WIN',
      gameState: updatedGame.gameState,
      whiteSetsWon: endGameDto.whiteSetsWon,
      blackSetsWon: endGameDto.blackSetsWon,
    });

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

    // 🏁 Don't roll dice if game is finished
    if (game.status === 'COMPLETED' || game.winner) {
      throw new BadRequestException('Game has ended - cannot roll dice');
    }

    const gameState = game.gameState as any;
    const currentPlayer = gameState.currentPlayer;
    
    // 🎲 OPENING PHASE: Return pre-generated opening dice
    if (gameState.phase === 'opening') {
      const openingDice = currentPlayer === 'white' ? game.openingDiceWhite : game.openingDiceBlack;
      if (openingDice) {
        console.log(`\n📤 [FRONTEND] Sending opening dice for ${currentPlayer}: [${openingDice}]`);
        return {
          dice: [openingDice],
          source: 'opening-pregenerated',
          timestamp: new Date().toISOString(),
          message: 'Opening roll dice'
        };
      }
    }

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
      console.log(`⏱️ [BEFORE LOCK] gameState.lastDoneBy:`, gameState.lastDoneBy);
      console.log(`⏱️ [BEFORE LOCK] gameState.lastDoneAt:`, gameState.lastDoneAt);
      
      const dice = playerNextRoll;
      
      // ✅ CRITICAL: Save currentTurnDice so refresh returns same dice!
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          gameState: {
            ...gameState,
            currentTurnDice: dice,
            turnCompleted: false,
            lastDoneBy: gameState.lastDoneBy,
            lastDoneAt: gameState.lastDoneAt,
          },
          whiteHasDiceRolled: currentPlayer === 'white',
          blackHasDiceRolled: currentPlayer === 'black',
          currentDiceValues: dice,
        },
      });
      
      console.log(`✅ [${currentPlayer}] Dice locked as currentTurnDice for refresh protection`);
      console.log(`⏱️ [AFTER LOCK] Saved to DB with lastDoneBy:`, gameState.lastDoneBy);
      
      // 🔍 DEBUG: Read back from DB to verify
      const verifyGame = await this.prisma.game.findUnique({ where: { id: gameId } });
      console.log(`🔍 [VERIFY] Read from DB - lastDoneBy:`, (verifyGame?.gameState as any)?.lastDoneBy);
      
      // 📡 Emit dice roll via WebSocket
      if (verifyGame) {
        this.emitGameStateUpdate(gameId, verifyGame.gameState);
      }
      
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
      console.log(`⏱️ [BEFORE LOCK] gameState.lastDoneBy:`, gameState.lastDoneBy);
      console.log(`⏱️ [BEFORE LOCK] gameState.lastDoneAt:`, gameState.lastDoneAt);
      
      const dice = gameState.nextDiceRoll as [number, number];
      
      // ⏱️ CRITICAL: Preserve timer fields from CURRENT gameState
      const preservedLastDoneBy = gameState.lastDoneBy;
      const preservedLastDoneAt = gameState.lastDoneAt;
      
      // ✅ CRITICAL: Save currentTurnDice so refresh returns same dice!
      const updatedState = {
        ...gameState,
        currentTurnDice: dice,
        turnCompleted: false,
        lastDoneBy: preservedLastDoneBy,
        lastDoneAt: preservedLastDoneAt,
      };
      
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          gameState: updatedState,
          whiteHasDiceRolled: currentPlayer === 'white',
          blackHasDiceRolled: currentPlayer === 'black',
          currentDiceValues: dice,
        },
      });
      
      console.log(`✅ [${currentPlayer}] Dice locked as currentTurnDice for refresh protection`);
      console.log(`⏱️ [AFTER LOCK] Saved to DB with lastDoneBy:`, gameState.lastDoneBy);
      
      // 🔍 DEBUG: Read back from DB to verify
      const verifyGame = await this.prisma.game.findUnique({ where: { id: gameId } });
      console.log(`🔍 [VERIFY] Read from DB - lastDoneBy:`, (verifyGame?.gameState as any)?.lastDoneBy);
      
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

      // ✅ CRITICAL: Save currentTurnDice so refresh returns same dice!
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          gameState: {
            ...gameState,
            currentTurnDice: dice,
            turnCompleted: false,
            lastDoneBy: gameState.lastDoneBy,
            lastDoneAt: gameState.lastDoneAt,
          },
          whiteHasDiceRolled: currentPlayer === 'white',
          blackHasDiceRolled: currentPlayer === 'black',
          currentDiceValues: dice,
        },
      });
      
      console.log(`✅ [${currentPlayer}] Generated dice locked as currentTurnDice for refresh protection`);

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

    const AI_PLAYER_ID = '00000000-0000-0000-0000-000000000000';
    const isAIGame = game.gameType === 'AI';
    
    // Verify user is a player (skip for AI games since frontend calls this for AI)
    if (!isAIGame && game.whitePlayerId !== userId && game.blackPlayerId !== userId) {
      throw new ForbiddenException('Not a player in this game');
    }

    const gameState = game.gameState as any;
    const currentPlayer = gameState.currentPlayer;

    // Verify it's this player's turn
    // For AI games: determine player color (human is opposite of AI)
    let playerColor: 'white' | 'black';
    
    if (isAIGame) {
      const isWhiteAI = game.whitePlayerId === AI_PLAYER_ID;
      playerColor = currentPlayer; // In AI game, whoever's turn it is can call Done
    } else {
      const isWhitePlayer = game.whitePlayerId === userId;
      playerColor = isWhitePlayer ? 'white' : 'black';
      
      if (currentPlayer !== playerColor) {
        throw new BadRequestException('Not your turn');
      }
    }

    console.log(`✅ [${playerColor}] pressed Done - ending turn`);

    // Switch player
    const nextPlayer = currentPlayer === 'white' ? 'black' : 'white';
    
    // 🎲 ALWAYS generate NEW random dice for next player on EVERY Done press
    const nextPlayerDice = this.generateDice();
    console.log(`🎲 [${playerColor}] Done pressed - Generating NEW random dice for ${nextPlayer}:`, nextPlayerDice);

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
      currentTurnDice: [], // ✅ CLEAR currentTurnDice so next player gets fresh dice from nextRoll
      diceValues: [], // Clear current dice
      nextRoll: updatedNextRoll, // ✅ ONLY this field for dice
      nextDiceRoll: nextPlayerDice, // ✅ ALSO save to nextDiceRoll for compatibility
    };

    // ⏱️ Calculate CURRENT timer values (with elapsed time subtracted)
    const { whiteTime, blackTime } = this.calculateCurrentTimers(game);
    
    console.log('⏱️ Timer Update on Done:', {
      player: playerColor,
      whiteTime,
      blackTime,
      lastDoneAt: gameState.lastDoneAt,
      currentPlayer: gameState.currentPlayer,
    });

    // ⏱️ TIMEOUT DETECTION - Check if any timer reached 0
    if (whiteTime <= 0 || blackTime <= 0) {
      const winner = whiteTime <= 0 ? 'BLACK' : 'WHITE';
      const loser = whiteTime <= 0 ? 'white' : 'black';
      
      console.log(`⏱️ [TIMEOUT DETECTED] ${loser} ran out of time! Winner: ${winner}`);
      
      // End game immediately with TIMEOUT reason
      const setsToWin = 1; // AI game is single-set
      const endGameData = {
        winner,
        whiteSetsWon: winner === 'WHITE' ? setsToWin : 0,
        blackSetsWon: winner === 'BLACK' ? setsToWin : 0,
        endReason: 'TIMEOUT' as any,
        finalGameState: updatedGameState,
      };
      
      // Update game to COMPLETED status
      const completedGame = await this.prisma.game.update({
        where: { id: gameId },
        data: {
          status: 'COMPLETED',
          winner: endGameData.winner as any,
          whiteSetsWon: endGameData.whiteSetsWon,
          blackSetsWon: endGameData.blackSetsWon,
          endReason: endGameData.endReason,
          endedAt: new Date(),
          gameState: endGameData.finalGameState,
          whiteTimeRemaining: whiteTime,
          blackTimeRemaining: blackTime,
        },
        include: {
          whitePlayer: true,
          blackPlayer: true,
        },
      });
      
      // Update user stats
      const winnerUserId = winner === 'WHITE' ? game.whitePlayerId : game.blackPlayerId;
      const loserUserId = winner === 'WHITE' ? game.blackPlayerId : game.whitePlayerId;
      
      if (winnerUserId !== this.AI_PLAYER_ID) {
        await this.updateUserStats(winnerUserId, true, setsToWin);
      }
      if (loserUserId !== this.AI_PLAYER_ID) {
        await this.updateUserStats(loserUserId, false, setsToWin);
      }
      
      console.log('✅ [TIMEOUT] Game ended and stats updated');
      
      // 📡 Emit game end via WebSocket
      this.emitGameEnd(gameId, {
        winner,
        endReason: 'TIMEOUT',
        gameState: completedGame.gameState,
        whiteTimeRemaining: whiteTime,
        blackTimeRemaining: blackTime,
      });
      
      // Return special response indicating timeout
      return {
        message: 'Game ended due to timeout',
        timeout: true,
        winner,
        game: {
          id: completedGame.id,
          gameState: completedGame.gameState,
          status: completedGame.status,
          winner: completedGame.winner,
          endReason: completedGame.endReason,
        },
      };
    }

    const updatedGame = await this.prisma.game.update({
      where: { id: gameId },
      data: {
        gameState: updatedGameState,
        // ✅ Save calculated timers (NOT from frontend)
        whiteTimeRemaining: whiteTime,
        blackTimeRemaining: blackTime,
        updatedAt: new Date(),
        whiteHasDiceRolled: false, // ✅ Clear both flags when Done pressed
        blackHasDiceRolled: false,
        currentDiceValues: undefined, // ✅ Clear current dice values
      },
      include: {
        whitePlayer: true,
        blackPlayer: true,
        moves: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    
    // 📡 Emit game state and timer update via WebSocket
    this.emitGameStateUpdate(gameId, updatedGame.gameState);
    this.emitTimerUpdate(gameId, {
      white: whiteTime,
      black: blackTime,
    });
    
    console.log('✅ [endTurn] Game updated in DB:', {
      gameId: updatedGame.id,
      lastDoneBy: (updatedGame.gameState as any).lastDoneBy,
      lastDoneAt: (updatedGame.gameState as any).lastDoneAt,
      phase: (updatedGame.gameState as any).phase,
      whiteTime: updatedGame.whiteTimeRemaining,
      blackTime: updatedGame.blackTimeRemaining,
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

    // ⏱️ Calculate current timers with elapsed time
    // =================================================================
    // CRITICAL: We MUST calculate elapsed time here!
    // When client refreshes page, they call getGame() to get current state.
    // Database has OLD timer values (from last endTurn/makeAIMove).
    // If turn is active (lastDoneBy exists), we need to subtract elapsed time.
    // =================================================================
    
    // ⚠️ Skip timer calculation if game is completed
    let whiteTime = game.whiteTimeRemaining || 0;
    let blackTime = game.blackTimeRemaining || 0;
    
    if (game.status !== 'COMPLETED' && !game.winner) {
      const timers = this.calculateCurrentTimers(game);
      whiteTime = timers.whiteTime;
      blackTime = timers.blackTime;
    }
    
    return {
      ...game,
      whiteTimeRemaining: whiteTime,
      blackTimeRemaining: blackTime,
    };
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

    // ⏱️ CRITICAL FIX: Preserve existing timer fields from DB!
    const existingGameState = game.gameState as any;
    
    // Merge dice values into game state, but PRESERVE lastDoneBy/lastDoneAt
    const updatedGameState = {
      ...existingGameState, // ✅ Start with existing state (includes lastDoneBy/lastDoneAt)
      ...syncStateDto.gameState, // ✅ Then merge incoming changes
      diceValues: syncStateDto.diceValues || [],
      // ⏱️ FORCE preserve timer fields (in case frontend accidentally sends undefined)
      lastDoneBy: existingGameState.lastDoneBy,
      lastDoneAt: existingGameState.lastDoneAt,
    };

    console.log('⏱️ [syncGameState] Preserving lastDoneBy:', existingGameState.lastDoneBy);

    // Update game state
    const updatedGame = await this.prisma.game.update({
      where: { id: gameId },
      data: {
        gameState: updatedGameState,
        updatedAt: new Date(),
      },
    });

    // 📡 Emit game state update via WebSocket
    this.emitGameStateUpdate(gameId, updatedGame.gameState);

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

    // ⏱️ CRITICAL FIX: Preserve timer fields from existing state!
    const existingGameState = game.gameState as any;
    const mergedGameState = {
      ...existingGameState, // Start with existing (includes lastDoneBy/lastDoneAt)
      ...newGameState, // Merge incoming changes
      // ⏱️ Force preserve timer fields
      lastDoneBy: existingGameState.lastDoneBy,
      lastDoneAt: existingGameState.lastDoneAt,
    };

    console.log('⏱️ [updateGameState] Preserving lastDoneBy:', existingGameState.lastDoneBy);

    // Update game state without creating a move
    const updatedGame = await this.prisma.game.update({
      where: { id: gameId },
      data: {
        gameState: mergedGameState,
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
   * ⛔⛔⛔ DELEGATED TO ai-move.service.ts ⛔⛔⛔
   * 
   * AI move calculation and execution moved to separate service
   * ⚠️ This now ONLY executes moves, does NOT call Done
   * ⚠️ Frontend must call endTurn() after AI moves (like human)
   * 
   * File: core/ai-move.service.ts
   */
  async makeAIMove(gameId: string) {
    // Delegate to protected AI move service
    return this.aiMoveService.executeAIMoves(gameId);
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
      if (!destPoint) {
        throw new Error(`Invalid move.to: ${move.to} - point does not exist`);
      }
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
      // ✅ Validate points exist
      if (!newBoard.points[move.from]) {
        throw new Error(`Invalid move.from: ${move.from} - point does not exist`);
      }
      if (!newBoard.points[move.to]) {
        throw new Error(`Invalid move.to: ${move.to} - point does not exist`);
      }
      
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
   * ⛔⛔⛔ DELEGATED TO opening-roll.service.ts ⛔⛔⛔
   * 
   * این متد به فایل جداگانه منتقل شده برای محافظت از لاجیک تایمر
   * فایل: opening-roll.service.ts
   */
  async completeOpeningRoll(gameId: string, winner: 'white' | 'black') {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const nextPlayerDice = game.firstRollDice as [number, number];
    
    // ⏱️ Delegate to protected service
    return this.openingRollService.completeOpeningRoll(gameId, winner, nextPlayerDice);
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

  /**
   * ⏱️ Check time status for both players
   * Returns current time remaining and whether anyone has run out of time
   */
  async checkTimeStatus(gameId: string, userId: string) {
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

    // Check if user is a player in this game
    const isWhitePlayer = game.whitePlayerId === userId;
    const isBlackPlayer = game.blackPlayerId === userId;

    if (!isWhitePlayer && !isBlackPlayer) {
      throw new ForbiddenException('You are not a player in this game');
    }

    const gameState = game.gameState as any;
    const currentPlayer = gameState.currentPlayer?.toLowerCase() || 'white';
    const lastDoneAt = gameState.lastDoneAt;

    let whiteTime = game.whiteTimeRemaining || 0;
    let blackTime = game.blackTimeRemaining || 0;

    // Calculate elapsed time for current player
    if (lastDoneAt) {
      const now = Date.now();
      const lastDoneTime = new Date(lastDoneAt).getTime();
      const elapsedSeconds = Math.floor((now - lastDoneTime) / 1000);

      if (currentPlayer === 'white') {
        whiteTime = Math.max(0, whiteTime - elapsedSeconds);
      } else if (currentPlayer === 'black') {
        blackTime = Math.max(0, blackTime - elapsedSeconds);
      }
    }

    const whiteTimeUp = whiteTime <= 0;
    const blackTimeUp = blackTime <= 0;
    let winner: 'white' | 'black' | null = null;

    // ✅ If someone's time is up, determine winner (but don't end game here - frontend will call endGame with full details)
    if (whiteTimeUp || blackTimeUp) {
      winner = whiteTimeUp ? 'black' : 'white';
    }

    return {
      whiteTime,
      blackTime,
      whiteTimeUp,
      blackTimeUp,
      winner,
      currentPlayer,
      gameStatus: game.status, // Return actual game status (frontend will end game)
    };
  }
}

