import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AIPlayerService, AIDifficulty } from '../ai/ai-player.service';

/**
 * ⛔⛔⛔ CRITICAL - DO NOT MODIFY THIS FILE! ⛔⛔⛔
 * 
 * AI Move Service - Handles AI move calculation and execution
 * 
 * 🔒 LOCKED - December 8, 2025
 * ================================================================
 * ⚠️ DO NOT MODIFY WITHOUT EXPLICIT APPROVAL!
 * 
 * AI MOVE FLOW (Refactored for PvP compatibility):
 * 
 * 1. AI calculates best moves using AI engine
 * 2. Moves are executed on board state
 * 3. Each move is SAVED to database (gameMove table)
 * 4. Board state is updated and saved
 * 5. ❌ NO TIMER UPDATE (Done is called from frontend like human)
 * 6. ❌ NO lastDoneBy/lastDoneAt update (Done button does this)
 * 
 * WHY SEPARATED:
 * - AI and Human use same flow (both call endTurn via frontend)
 * - Moves are always saved (needed for PvP replay/sync)
 * - Timer logic stays in one place (endTurn)
 * - Ready for multiplayer (same behavior)
 * 
 * ⛔ This service ONLY handles move calculation and execution
 * ⛔ Frontend calls handleDone() after AI moves (like human)
 * ================================================================
 */

@Injectable()
export class AIMoveService {
  private readonly AI_PLAYER_ID = '00000000-0000-0000-0000-000000000001';

  constructor(
    private prisma: PrismaService,
    private aiPlayerService: AIPlayerService,
  ) {}

  /**
   * Calculate and execute AI moves
   * ⚠️ Does NOT call Done - frontend must call endTurn after this
   */
  async executeAIMoves(gameId: string) {
    console.log('🤖 [AI] Starting move calculation...');
    
    // Wait for any pending operations
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Fetch fresh game state
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Game completed check
    if (game.status === 'COMPLETED' || game.winner) {
      console.log('🏁 [AI] Game already finished');
      return { moves: [], gameState: game.gameState };
    }

    if (game.gameType !== 'AI') {
      throw new BadRequestException('This is not an AI game');
    }

    if (game.status !== 'ACTIVE') {
      throw new BadRequestException('Game is not active');
    }

    const gameState = game.gameState as any;
    
    // Determine AI color
    const isWhiteAI = game.whitePlayerId === this.AI_PLAYER_ID;
    const aiColor = isWhiteAI ? 'white' : 'black';
    const currentPlayer = (gameState.currentPlayer || 'white').toLowerCase();
    
    // Verify it's AI's turn
    if (currentPlayer !== aiColor) {
      throw new BadRequestException(`Not AI turn - current: ${currentPlayer}, AI: ${aiColor}`);
    }

    // ✅ Get dice roll
    let diceRoll: [number, number];
    
    if (gameState.currentTurnDice && gameState.currentTurnDice.length >= 2 && 
        gameState.lastDoneBy !== aiColor) {
      diceRoll = [gameState.currentTurnDice[0], gameState.currentTurnDice[1]];
      console.log('🔒 AI using LOCKED dice (currentTurnDice):', diceRoll);
    } else if (gameState.nextDiceRoll && gameState.nextDiceRoll.length >= 2) {
      diceRoll = [gameState.nextDiceRoll[0], gameState.nextDiceRoll[1]];
      console.log('🎲 AI using pre-generated dice (nextDiceRoll):', diceRoll);
      
      // Lock dice immediately
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          gameState: {
            ...gameState,
            currentTurnDice: diceRoll,
            diceValues: diceRoll,
            phase: 'moving',
            lastDoneBy: gameState.lastDoneBy,
            lastDoneAt: gameState.lastDoneAt,
          },
        },
      });
    } else if (gameState.diceValues && gameState.diceValues.length >= 2) {
      diceRoll = [gameState.diceValues[0], gameState.diceValues[1]];
    } else {
      throw new BadRequestException('No dice available for AI');
    }

    // Get AI difficulty from game (not gameState)
    const difficulty = ((game as any).aiDifficulty || 'MEDIUM') as AIDifficulty;

    // Convert to AI format
    const currentBoard = this.convertToAIFormat(gameState);

    // Simulate thinking time
    await this.aiPlayerService.simulateThinkingTime(difficulty);

    // Calculate AI moves
    const moves = await this.aiPlayerService.makeMove(currentBoard, diceRoll, difficulty);
    
    console.log(`🤖 [AI] Calculated ${moves.length} moves:`, moves);

    // Execute moves and save each one
    let moveNumber = (await this.prisma.gameMove.count({ where: { gameId } })) + 1;
    
    for (const move of moves) {
      const boardBefore = JSON.parse(JSON.stringify(currentBoard));
      this.applyMoveToBoard(currentBoard, move);
      const boardAfter = JSON.parse(JSON.stringify(currentBoard));
      
      // ✅ Save move to database (for PvP replay/sync)
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
    
    // ✅ Keep AI as currentPlayer (will switch when Done is pressed)
    // ✅ Update phase to 'moving' (AI is executing moves)
    newGameState.phase = 'moving';
    newGameState.currentPlayer = aiColor; // ⚠️ KEEP AI until Done pressed!
    newGameState.currentTurnDice = diceRoll;
    newGameState.diceValues = diceRoll;
    
    // ❌ DO NOT update lastDoneBy/lastDoneAt here!
    // ❌ DO NOT calculate timer here!
    // Frontend will call endTurn() which handles timer + Done

    // Save updated board state
    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        gameState: newGameState,
        updatedAt: new Date(),
      },
    });

    console.log('✅ [AI] Moves executed and saved. Waiting for frontend to call Done.');

    return {
      moves,
      diceRoll,
      difficulty,
      gameState: newGameState,
    };
  }

  /**
   * Convert game state to AI format
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
   * Convert AI format back to game state
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
      currentPlayer: aiBoard.currentPlayer,
    };
  }

  /**
   * Apply a single move to board state
   */
  private applyMoveToBoard(boardState: any, move: { from: number; to: number }) {
    const color = boardState.currentPlayer;
    const opponentColor = color === 'white' ? 'black' : 'white';

    if (!boardState.bar) boardState.bar = { white: 0, black: 0 };
    if (!boardState.off) boardState.off = { white: 0, black: 0 };

    // Move from bar
    if (move.from === -1) {
      boardState.bar[color]--;
      const destPoint = boardState.points[move.to];
      if (destPoint[opponentColor] === 1) {
        destPoint[opponentColor] = 0;
        boardState.bar[opponentColor]++;
      }
      boardState.points[move.to][color]++;
    }
    // Bear off
    else if (move.to === -1 || move.to === 24) {
      boardState.points[move.from][color]--;
      boardState.off[color]++;
    }
    // Normal move
    else {
      const fromPoint = boardState.points[move.from];
      const toPoint = boardState.points[move.to];
      
      fromPoint[color]--;
      
      if (toPoint[opponentColor] === 1) {
        toPoint[opponentColor] = 0;
        boardState.bar[opponentColor]++;
      }
      
      toPoint[color]++;
    }
  }
}
