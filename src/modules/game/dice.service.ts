import { Injectable } from '@nestjs/common';

/**
 * Service for generating fair dice rolls on the server-side
 * to prevent client-side manipulation
 */
@Injectable()
export class DiceService {
  /**
   * Generate two random dice values between 1 and 6
   * @returns Array of two dice values [dice1, dice2]
   */
  rollTwoDice(): [number, number] {
    const dice1 = this.rollSingleDie();
    const dice2 = this.rollSingleDie();
    return [dice1, dice2];
  }

  /**
   * Generate a single random dice value between 1 and 6
   * @returns Single dice value (1-6)
   */
  rollSingleDie(): number {
    return Math.floor(Math.random() * 6) + 1;
  }

  /**
   * Roll dice for opening roll (one die per player)
   * Returns different values to avoid tie
   * @returns Object with white and black dice values
   */
  rollOpeningDice(): { white: number; black: number } {
    const whiteDie = this.rollSingleDie();
    let blackDie = this.rollSingleDie();
    
    // Prevent tie - reroll black die if same as white
    while (blackDie === whiteDie) {
      blackDie = this.rollSingleDie();
    }
    
    return { white: whiteDie, black: blackDie };
  }

  /**
   * Validate dice values (for testing or anti-cheat)
   * @param dice Array of dice values
   * @returns Boolean indicating if dice are valid
   */
  validateDice(dice: number[]): boolean {
    if (!Array.isArray(dice)) return false;
    if (dice.length !== 2) return false;
    
    return dice.every(die => 
      Number.isInteger(die) && die >= 1 && die <= 6
    );
  }
}
