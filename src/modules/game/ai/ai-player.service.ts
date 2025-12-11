/**
 * ⚠️ WARNING: این فایل تست شده است و نباید دستکاری شود!
 * این فایل بعد از هفته‌ها کار روی movement direction و game logic تکمیل شده.
 * تنها در صورتی تغییر دهید که:
 * 1. خطای محرز و قابل تکرار وجود دارد
 * 2. می‌توانید بدون تداخل با سایر بخش‌ها مشکل را حل کنید
 * 3. تغییرات را به صورت جداگانه تست کرده‌اید
 * در غیر این صورت حق دستکاری این فایل را ندارید!
 */

import { Injectable } from '@nestjs/common';

export interface BoardState {
  points: Array<{ white: number; black: number }>;
  bar: { white: number; black: number };
  off: { white: number; black: number };
  currentPlayer: 'white' | 'black';
}

export interface AIMove {
  from: number;
  to: number;
  diceUsed: number;
}

export enum AIDifficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
  EXPERT = 'EXPERT',
}

@Injectable()
export class AIPlayerService {
  /**
   * AI makes a move based on board state and difficulty
   */
  async makeMove(
    boardState: BoardState,
    diceRoll: [number, number],
    difficulty: AIDifficulty = AIDifficulty.MEDIUM
  ): Promise<AIMove[]> {
    const possibleMoves = this.generatePossibleMoves(boardState, diceRoll);

    if (possibleMoves.length === 0) {
      return []; // No moves available
    }

    // Select moves based on difficulty
    switch (difficulty) {
      case AIDifficulty.EASY:
        return this.selectRandomMove(possibleMoves);

      case AIDifficulty.MEDIUM:
        return this.selectDecentMove(possibleMoves, boardState);

      case AIDifficulty.HARD:
        return this.selectGoodMove(possibleMoves, boardState);

      case AIDifficulty.EXPERT:
        return this.selectBestMove(possibleMoves, boardState);

      default:
        return this.selectRandomMove(possibleMoves);
    }
  }

  /**
   * Generate all possible moves for the AI
   * این فانکشن باید همه ترکیبات ممکن رو امتحان کنه
   */
  private generatePossibleMoves(
    boardState: BoardState,
    diceRoll: [number, number]
  ): AIMove[][] {
    const [die1, die2] = diceRoll;
    const isDouble = die1 === die2;
    const aiColor = boardState.currentPlayer;
    
    // For doubles, we can use each die up to 4 times
    const diceToUse = isDouble ? [die1, die1, die1, die1] : [die1, die2];

    console.log(`🎲 Generating moves for dice: ${diceToUse.join(', ')}`);

    // ✅ حالا از همه checker ها شروع میکنیم (نه فقط یکی!)
    const allSequences: AIMove[][] = [];
    this.generateAllPossibleSequences(
      boardState,
      diceToUse,
      aiColor,
      [],
      allSequences
    );

    console.log(`✅ Found ${allSequences.length} possible move sequences`);

    // If no moves found, return empty
    return allSequences.length > 0 ? allSequences : [];
  }

  /**
   * Generate all possible move sequences (با همه checker ها)
   */
  private generateAllPossibleSequences(
    boardState: BoardState,
    remainingDice: number[],
    color: 'white' | 'black',
    currentSequence: AIMove[],
    allSequences: AIMove[][]
  ): void {
    // Base case: اگر تاس نمونده، این sequence رو ذخیره کن
    if (remainingDice.length === 0) {
      if (currentSequence.length > 0) {
        allSequences.push([...currentSequence]);
      }
      return;
    }

    // Get all movable checkers
    const movableCheckers = this.getMovableCheckers(boardState, color);

    let foundValidMove = false;

    // امتحان کردن هر تاس با هر checker
    for (const die of remainingDice) {
      for (const from of movableCheckers) {
        const to = this.calculateDestination(from, die, color);

        // Check if this move is valid
        if (this.isValidMove(boardState, from, to, color)) {
          foundValidMove = true;
          const move: AIMove = { from, to, diceUsed: die };

          // Apply move temporarily
          const newBoard = this.applyTempMove(boardState, move, color);
          
          // Remove used die
          const newRemaining = remainingDice.filter((d, i) => {
            // Remove first occurrence of this die value
            if (d === die && i === remainingDice.indexOf(die)) {
              return false;
            }
            return true;
          });

          // Recurse with new board state
          this.generateAllPossibleSequences(
            newBoard,
            newRemaining,
            color,
            [...currentSequence, move],
            allSequences
          );
        }
      }
    }

    // اگر حرکت نکردیم ولی sequence داریم، ذخیره کن (partial moves)
    if (!foundValidMove && currentSequence.length > 0) {
      allSequences.push([...currentSequence]);
    }
  }

  /**
   * Get all checkers that can potentially move
   */
  private getMovableCheckers(boardState: BoardState, color: 'white' | 'black'): number[] {
    const checkers: number[] = [];
    
    // Check if we have checkers on the bar (must move these first)
    if (boardState.bar[color] > 0) {
      return [-1]; // -1 represents bar
    }

    // Check all points for movable checkers
    for (let i = 0; i < 24; i++) {
      if (boardState.points[i][color] > 0) {
        checkers.push(i);
      }
    }

    return checkers;
  }

  /**
   * Generate all possible move sequences for a checker
   * این فانکشن باید کل sequence حرکات رو generate کنه
   */
  private generateMoveSequences(
    boardState: BoardState,
    from: number,
    dice: number[],
    color: 'white' | 'black'
  ): AIMove[][] {
    const sequences: AIMove[][] = [];

    // 🎯 حالا باید کل sequence رو generate کنیم
    this.generateMovesRecursive(
      boardState,
      from,
      dice,
      color,
      [],
      sequences
    );

    return sequences;
  }

  /**
   * Generate moves recursively - برای پیدا کردن همه حرکات ممکن
   */
  private generateMovesRecursive(
    boardState: BoardState,
    currentPos: number,
    remainingDice: number[],
    color: 'white' | 'black',
    currentSequence: AIMove[],
    allSequences: AIMove[][],
    originalDiceCount: number = remainingDice.length
  ): void {
    // Base case: اگر تاس نمونده، این sequence رو اضافه کن
    if (remainingDice.length === 0) {
      if (currentSequence.length > 0) {
        allSequences.push([...currentSequence]);
      }
      return;
    }

    // Try each remaining die
    for (let i = 0; i < remainingDice.length; i++) {
      const die = remainingDice[i];
      const to = this.calculateDestination(currentPos, die, color);

      // Check if move is valid
      if (this.isValidMove(boardState, currentPos, to, color)) {
        const move: AIMove = { from: currentPos, to, diceUsed: die };

        // Apply this move temporarily
        const newBoard = this.applyTempMove(boardState, move, color);
        const newRemaining = [...remainingDice];
        newRemaining.splice(i, 1); // Remove used die

        // Recurse with new state
        this.generateMovesRecursive(
          newBoard,
          to, // Next move starts from destination
          newRemaining,
          color,
          [...currentSequence, move],
          allSequences,
          originalDiceCount
        );
      }
    }

    // Also save current sequence if it's not empty (partial moves are valid)
    if (currentSequence.length > 0 && remainingDice.length < originalDiceCount) {
      allSequences.push([...currentSequence]);
    }
  }

  /**
   * Apply move temporarily for evaluation
   */
  private applyTempMove(
    boardState: BoardState,
    move: AIMove,
    color: 'white' | 'black'
  ): BoardState {
    const newBoard = JSON.parse(JSON.stringify(boardState));
    const opponentColor = color === 'white' ? 'black' : 'white';

    // Remove from source
    if (move.from === -1) {
      newBoard.bar[color]--;
    } else {
      newBoard.points[move.from][color]--;
    }

    // Add to destination
    if (move.to < 0 || move.to > 23) {
      // Bear off
      newBoard.off[color]++;
    } else {
      // Check for hit
      if (newBoard.points[move.to][opponentColor] === 1) {
        newBoard.bar[opponentColor]++;
        newBoard.points[move.to][opponentColor] = 0;
      }
      newBoard.points[move.to][color]++;
    }

    return newBoard;
  }

  /**
   * Calculate destination point based on direction
   * قوانین محکم: سفید 23→0 (منهای)، مشکی 0→23 (جمع)
   */
  private calculateDestination(from: number, die: number, color: 'white' | 'black'): number {
    // Bar moves (entering from bar)
    if (from === -1) {
      // سفید از bar وارد 24-die میشه، مشکی از bar وارد die-1 میشه
      return color === 'white' ? 24 - die : die - 1;
    }

    // Regular moves - قوانین محکم!
    if (color === 'white') {
      // ⚪ سفید: از 23 به سمت 0 حرکت میکنه (منهای میشه)
      return from - die;
    } else {
      // ⚫ مشکی: از 0 به سمت 23 حرکت میکنه (جمع میشه)
      return from + die;
    }
  }

  /**
   * Check if a move is valid according to backgammon rules
   */
  private isValidMove(
    boardState: BoardState,
    from: number,
    to: number,
    color: 'white' | 'black'
  ): boolean {
    // Check if destination is out of bounds (bearing off)
    if (to < 0 || to > 23) {
      return this.isValidBearOff(boardState, from, to, color);
    }

    // Check if destination point is blocked by opponent
    const opponentColor = color === 'white' ? 'black' : 'white';
    const destPoint = boardState.points[to];

    // Can't move to a point with 2+ opponent checkers
    if (destPoint[opponentColor] >= 2) {
      return false;
    }

    return true;
  }

  /**
   * Check if player can bear off (remove checkers from board)
   * قوانین: سفید home board = 0-5، مشکی home board = 18-23
   */
  private canBearOff(boardState: BoardState, color: 'white' | 'black'): boolean {
    // All checkers must be in home board
    // ⚪ سفید: home = 0-5 (چون به سمت 0 میره)
    // ⚫ مشکی: home = 18-23 (چون به سمت 23 میره)
    const homeStart = color === 'white' ? 0 : 18;
    const homeEnd = color === 'white' ? 6 : 24;

    for (let i = 0; i < 24; i++) {
      if (boardState.points[i][color] > 0) {
        if (color === 'white' && (i < homeStart || i >= homeEnd)) return false;
        if (color === 'black' && (i < homeStart || i >= homeEnd)) return false;
      }
    }

    // Also check bar
    if (boardState.bar[color] > 0) return false;

    return true;
  }

  /**
   * Check if specific bear-off move is valid
   * قوانین مهم:
   * 1. تاس باید دقیقا با position مهره match کنه
   * 2. اگه تاس بزرگتر بود، فقط از بالاترین (دورترین) مهره میشه خارج کرد
   * 
   * ⚪ سفید: خونه 0-5 → position 1-6 (خونه 0 = position 1)
   * ⚫ مشکی: خونه 18-23 → position 6-1 (خونه 18 = position 6, خونه 23 = position 1)
   */
  private isValidBearOff(
    boardState: BoardState,
    from: number,
    to: number,
    color: 'white' | 'black'
  ): boolean {
    // First check if player can bear off at all
    if (!this.canBearOff(boardState, color)) {
      return false;
    }

    // Calculate position and die value
    let position: number;
    let die: number;

    if (color === 'white') {
      // ⚪ سفید: خونه 0 = position 1, خونه 5 = position 6
      position = from + 1;
      die = from - to; // to is negative, so from - to = die
    } else {
      // ⚫ مشکی: خونه 23 = position 1, خونه 18 = position 6
      position = 24 - from;
      die = to - from; // to is > 23, so to - from = die
    }

    // Exact match: تاس دقیقا با position مهره برابره
    if (position === die) {
      return true;
    }

    // Higher die: تاس بزرگتر از position است
    // فقط میشه اگه این بالاترین (دورترین) مهره باشه
    if (die > position) {
      if (color === 'white') {
        // چک کن خونه‌های 5, 4, 3, ... تا from+1
        for (let p = 5; p > from; p--) {
          if (boardState.points[p][color] > 0) {
            return false; // مهره بالاتری وجود داره
          }
        }
      } else {
        // ⚫ مشکی: چک کن خونه‌های 18, 19, 20, ... تا from-1
        for (let p = 18; p < from; p++) {
          if (boardState.points[p][color] > 0) {
            return false; // مهره بالاتری وجود داره
          }
        }
      }
      return true;
    }

    // تاس کوچکتر از position - نمیشه خارج کرد
    return false;
  }

  /**
   * EASY: Random move selection
   */
  private selectRandomMove(moves: AIMove[][]): AIMove[] {
    const randomIndex = Math.floor(Math.random() * moves.length);
    return moves[randomIndex];
  }

  /**
   * MEDIUM: Select decent moves (avoid obvious mistakes)
   */
  private selectDecentMove(moves: AIMove[][], boardState: BoardState): AIMove[] {
    // Score each move sequence
    const scoredMoves = moves.map((moveSeq) => ({
      moves: moveSeq,
      score: this.evaluateMoveSequence(moveSeq, boardState, 'medium'),
    }));

    // Sort by score and pick from top 50%
    scoredMoves.sort((a, b) => b.score - a.score);
    const topHalf = scoredMoves.slice(0, Math.ceil(scoredMoves.length / 2));
    const randomIndex = Math.floor(Math.random() * topHalf.length);
    
    return topHalf[randomIndex].moves;
  }

  /**
   * HARD: Select good strategic moves
   */
  private selectGoodMove(moves: AIMove[][], boardState: BoardState): AIMove[] {
    const scoredMoves = moves.map((moveSeq) => ({
      moves: moveSeq,
      score: this.evaluateMoveSequence(moveSeq, boardState, 'hard'),
    }));

    // Sort and pick from top 25%
    scoredMoves.sort((a, b) => b.score - a.score);
    const topQuarter = scoredMoves.slice(0, Math.ceil(scoredMoves.length / 4));
    const randomIndex = Math.floor(Math.random() * topQuarter.length);
    
    return topQuarter[randomIndex].moves;
  }

  /**
   * EXPERT: Always pick the best move
   */
  private selectBestMove(moves: AIMove[][], boardState: BoardState): AIMove[] {
    const scoredMoves = moves.map((moveSeq) => ({
      moves: moveSeq,
      score: this.evaluateMoveSequence(moveSeq, boardState, 'expert'),
    }));

    // Return highest scored move
    scoredMoves.sort((a, b) => b.score - a.score);
    return scoredMoves[0].moves;
  }

  /**
   * Evaluate a move sequence based on difficulty level
   */
  private evaluateMoveSequence(
    moves: AIMove[],
    boardState: BoardState,
    difficulty: string
  ): number {
    let score = 0;

    // Strategy weights based on difficulty
    const weights: Record<string, { safety: number; advancement: number; blocking: number; hitting: number }> = {
      medium: { safety: 0.4, advancement: 0.3, blocking: 0.2, hitting: 0.1 },
      hard: { safety: 0.3, advancement: 0.3, blocking: 0.2, hitting: 0.2 },
      expert: { safety: 0.25, advancement: 0.25, blocking: 0.25, hitting: 0.25 },
    };

    const w = weights[difficulty] || weights.medium;

    // Evaluate each move
    for (const move of moves) {
      // Safety: Avoid leaving blots (single checkers)
      score += this.evaluateSafety(move, boardState) * w.safety;

      // Advancement: Move checkers forward
      score += this.evaluateAdvancement(move) * w.advancement;

      // Blocking: Create blocking points
      score += this.evaluateBlocking(move, boardState) * w.blocking;

      // Hitting: Hit opponent's blots
      score += this.evaluateHitting(move, boardState) * w.hitting;
    }

    return score;
  }

  /**
   * Evaluate safety of a move (avoid leaving blots)
   */
  private evaluateSafety(move: AIMove, boardState: BoardState): number {
    let score = 0;
    const to = move.to;

    // Bearing off is always safe
    if (to < 0 || to > 23) {
      return 1.0;
    }

    const aiColor = boardState.currentPlayer;
    const opponentColor = aiColor === 'white' ? 'black' : 'white';

    // Check if destination would create a blot (single checker)
    const destPoint = boardState.points[to];
    if (destPoint[aiColor] === 0) {
      // Creating a new blot - check if opponent can hit
      const canBeHit = this.canOpponentHit(boardState, to, opponentColor);
      score = canBeHit ? -0.5 : 0.5;
    } else {
      // Moving to existing checker(s) - safer
      score = 0.8;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Check if opponent can hit this point
   */
  private canOpponentHit(boardState: BoardState, point: number, opponentColor: 'white' | 'black'): boolean {
    // Check points within 6 spaces (max die value)
    for (let dist = 1; dist <= 6; dist++) {
      const opponentPoint = opponentColor === 'white' ? point - dist : point + dist;
      
      if (opponentPoint >= 0 && opponentPoint < 24) {
        if (boardState.points[opponentPoint][opponentColor] > 0) {
          return true;
        }
      }
    }
    
    // Check if opponent has checkers on bar
    if (boardState.bar[opponentColor] > 0) {
      return true;
    }

    return false;
  }

  /**
   * Evaluate forward progress
   */
  private evaluateAdvancement(move: AIMove): number {
    // Further moves get higher scores
    const distance = Math.abs(move.to - move.from);
    return distance / 24; // Normalize to 0-1
  }

  /**
   * Evaluate blocking potential
   */
  private evaluateBlocking(move: AIMove, boardState: BoardState): number {
    const to = move.to;
    
    // Bearing off doesn't block
    if (to < 0 || to > 23) {
      return 0;
    }

    const aiColor = boardState.currentPlayer;
    const destPoint = boardState.points[to];

    // Creating a point (2+ checkers) blocks opponent
    if (destPoint[aiColor] >= 1) {
      return 0.8;
    }

    return 0.2;
  }

  /**
   * Evaluate hitting opponent checker
   */
  private evaluateHitting(move: AIMove, boardState: BoardState): number {
    const to = move.to;
    
    if (to < 0 || to > 23) {
      return 0;
    }

    const aiColor = boardState.currentPlayer;
    const opponentColor = aiColor === 'white' ? 'black' : 'white';
    const destPoint = boardState.points[to];

    // If opponent has exactly 1 checker, we can hit it
    if (destPoint[opponentColor] === 1) {
      return 1.0;
    }

    return 0;
  }

  /**
   * Simulate AI thinking time (for realism)
   */
  async simulateThinkingTime(difficulty: AIDifficulty): Promise<void> {
    const delays = {
      [AIDifficulty.EASY]: [500, 1500],       // 0.5-1.5 seconds
      [AIDifficulty.MEDIUM]: [1000, 3000],    // 1-3 seconds
      [AIDifficulty.HARD]: [2000, 5000],      // 2-5 seconds
      [AIDifficulty.EXPERT]: [3000, 7000],    // 3-7 seconds
    };

    const [min, max] = delays[difficulty];
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
}
