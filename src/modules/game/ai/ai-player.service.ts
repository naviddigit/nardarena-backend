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
   */
  private generatePossibleMoves(
    boardState: BoardState,
    diceRoll: [number, number]
  ): AIMove[][] {
    // TODO: Implement backgammon rules to generate valid moves
    // این باید logic کامل نرد رو پیاده کنه
    return [];
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

  private evaluateSafety(move: AIMove, boardState: BoardState): number {
    // TODO: Check if destination point is safe
    return 0;
  }

  private evaluateAdvancement(move: AIMove): number {
    // Forward progress is good
    return move.to - move.from;
  }

  private evaluateBlocking(move: AIMove, boardState: BoardState): number {
    // TODO: Check if move creates/maintains blocking points
    return 0;
  }

  private evaluateHitting(move: AIMove, boardState: BoardState): number {
    // TODO: Check if move hits opponent
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
