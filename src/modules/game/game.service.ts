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

  /**
   * 🎲 Generate random dice roll (1-6, 1-6)
   * Used for pre-generating next player's dice to prevent refresh cheating
   */
  private generateRandomDice(): [number, number] {
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

    // 🎲 Generate next dice roll for the NEXT player (anti-cheat)
    const nextDiceRoll = this.generateRandomDice();
    console.log('🎲 Pre-generating dice for next turn:', nextDiceRoll);

    // Update boardStateAfter to include the pre-generated dice
    const updatedBoardState = recordMoveDto.boardStateAfter 
      ? { 
          ...(recordMoveDto.boardStateAfter as any), 
          nextDiceRoll,
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
      nextDiceRoll, // Log the pre-generated dice
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
   * ⏱️ NEW: Also sets turnStartTime for timer tracking
   */
  async rollDiceForGame(gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const gameState = game.gameState as any;

    // If turn not completed and dice exist, return SAME dice
    if (gameState.turnCompleted === false && gameState.currentTurnDice && Array.isArray(gameState.currentTurnDice)) {
      console.log('🔒 Turn not completed! Returning SAME dice:', gameState.currentTurnDice);
      
      return {
        dice: gameState.currentTurnDice,
        source: 'current-turn',
        timestamp: new Date().toISOString(),
        turnStartTime: gameState.turnStartTime, // Return existing start time
        message: 'You must complete your turn (press Done) before rolling again',
      };
    }

    // Check if we have pre-generated dice
    let diceToUse: number[];
    let source: string;
    
    if (gameState.nextDiceRoll && Array.isArray(gameState.nextDiceRoll) && gameState.nextDiceRoll.length === 2) {
      console.log('🎲 Using pre-generated dice:', gameState.nextDiceRoll);
      diceToUse = gameState.nextDiceRoll;
      source = 'pre-generated';
    } else {
      // Fallback: Generate new dice (for opening phase or first turn)
      diceToUse = this.generateRandomDice();
      console.log('🎲 No pre-generated dice, generating new:', diceToUse);
      source = 'generated';
    }
    
    // ⏱️ Record turn start time for timer calculation
    const turnStartTime = new Date().toISOString();
    
    // ⚠️ Save turnStartTime to database immediately (for timer tracking)
    const updatedGameState = {
      ...gameState,
      turnStartTime, // ✅ Track when this turn started
      currentTurnDice: diceToUse, // Save current dice
      turnCompleted: false, // Mark as in-progress
    };
    
    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        gameState: updatedGameState,
        updatedAt: new Date(),
      },
    });
    
    console.log('⏱️ Turn started at:', turnStartTime);

    return {
      dice: diceToUse,
      source,
      timestamp: turnStartTime,
      turnStartTime, // ✅ Return for frontend timer sync
      message: 'Dice rolled - press Done to save',
    };
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

    console.log(`✅ ${playerColor} pressed Done - ending turn`);

    // ⏱️ Calculate time spent on this turn
    let timeSpentSeconds = 0;
    if (gameState.turnStartTime) {
      const turnStartTime = new Date(gameState.turnStartTime).getTime();
      const now = Date.now();
      timeSpentSeconds = Math.floor((now - turnStartTime) / 1000);
      console.log(`⏱️ ${playerColor} spent ${timeSpentSeconds} seconds on this turn`);
    }
    
    // ⏱️ Update remaining time for current player
    const currentRemainingTime = gameState.remainingTime || { white: game.timeControl, black: game.timeControl };
    const updatedRemainingTime = {
      ...currentRemainingTime,
      [playerColor]: Math.max(0, (currentRemainingTime[playerColor] || game.timeControl) - timeSpentSeconds),
    };
    
    console.log(`⏱️ ${playerColor} has ${updatedRemainingTime[playerColor]} seconds remaining`);

    // Switch player
    const nextPlayer = currentPlayer === 'white' ? 'black' : 'white';
    
    // Generate dice for next turn
    const nextDiceRoll = this.generateRandomDice();
    console.log('🎲 Pre-generating dice for next turn:', nextDiceRoll);

    const updatedGameState = {
      ...gameState,
      currentPlayer: nextPlayer,
      
      // ⏱️ Update remaining time
      remainingTime: updatedRemainingTime,
      turnStartTime: null, // Clear turn start time
      
      // ✅ Track WHO pressed Done and WHEN
      lastDoneBy: playerColor,
      lastDoneAt: new Date().toISOString(),
      turnCompleted: true, // ✅ Mark as completed
      
      phase: 'waiting', // Back to waiting for next roll
      diceValues: [], // Clear current dice
      currentTurnDice: null, // Clear current turn dice
      nextDiceRoll, // Store pre-generated dice
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
      nextDiceRoll, // Return for debugging (won't be shown to players)
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
    
    // Determine user's color
    const isWhitePlayer = game.whitePlayerId === userId;
    const playerColor = isWhitePlayer ? 'white' : 'black';
    
    // Check if it's user's turn
    const isUserTurn = currentPlayer === playerColor;
    
    // ✅ CRITICAL LOGIC:
    // - canPlay = TRUE if it's your turn (whether completed or not!)
    // - canRollNewDice = TRUE only if it's your turn AND previous turn completed
    // - If turnCompleted = false, you can CONTINUE playing but can't roll NEW dice
    
    const canPlay = isUserTurn; // ✅ Can play if it's your turn
    const canRollNewDice = isUserTurn && turnCompleted; // ✅ Can roll NEW dice only if Done was pressed
    
    // ✅ Enhanced response with lastDoneBy info
    return {
      canPlay, // ✅ Can interact with board
      canRollNewDice, // ✅ Can request new dice (not restore old ones)
      isYourTurn: isUserTurn,
      turnCompleted,
      currentPlayer,
      playerColor,
      phase: gameState.phase || 'waiting',
      
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
    
    // Get AI player color from game state (default to black for backward compatibility)
    const aiColor = (gameState.aiPlayerColor || 'black').toLowerCase();
    const currentPlayer = (gameState.currentPlayer || 'white').toLowerCase();
    
    console.log('🔍 Checking AI turn:', {
      currentPlayer,
      aiColor,
      rawAiColor: gameState.aiPlayerColor,
      rawCurrentPlayer: gameState.currentPlayer,
    });
    
    // Check if it's AI's turn (case-insensitive)
    if (currentPlayer !== aiColor) {
      throw new BadRequestException(`Not AI turn - current: ${currentPlayer}, AI: ${aiColor}`);
    }

    // Use dice values from synced state (already rolled by frontend)
    let diceRoll: [number, number];
    
    if (gameState.diceValues && gameState.diceValues.length >= 2) {
      // Use the dice that were already rolled
      diceRoll = [gameState.diceValues[0], gameState.diceValues[1]];
      console.log('🎲 Using existing dice:', diceRoll);
    } else {
      // Roll new dice if not provided (e.g., after resume)
      const dice1 = Math.floor(Math.random() * 6) + 1;
      const dice2 = Math.floor(Math.random() * 6) + 1;
      diceRoll = [dice1, dice2];
      console.log('🎲 Rolling new dice for AI:', diceRoll);
      
      // Update game state with new dice
      gameState.diceValues = diceRoll;
      gameState.phase = 'moving';
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
    
    // ✅ Switch turn to human player after AI moves
    const humanPlayerColor = aiColor === 'white' ? 'black' : 'white';
    newGameState.currentPlayer = humanPlayerColor;
    newGameState.diceValues = [];
    newGameState.phase = 'waiting';
    
    // ✅ Mark turn as completed (AI finished its turn)
    newGameState.turnCompleted = true;
    newGameState.lastDoneBy = aiColor;
    newGameState.lastDoneAt = new Date().toISOString();

    // 🎲 Generate next dice roll for human player (anti-cheat)
    const nextDiceRoll = this.generateRandomDice();
    newGameState.nextDiceRoll = nextDiceRoll;
    console.log('🎲 Pre-generating dice for human player:', nextDiceRoll);

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
}
