import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

/**
 * ⛔⛔⛔ CRITICAL - DO NOT MODIFY THIS FILE! ⛔⛔⛔
 * 
 * Opening Roll Service - Handles opening roll completion
 * 
 * 🔒 LOCKED - December 8, 2025
 * ================================================================
 * ⚠️ DO NOT MODIFY WITHOUT EXPLICIT APPROVAL!
 * ⚠️ این فایل به صورت جداگانه برای محافظت از لاجیک تایمر ایجاد شده
 * ⚠️ هرگونه تغییر در این فایل موجب خرابی سیستم تایمر میشود
 * ================================================================
 */

@Injectable()
export class OpeningRollService {
  constructor(private prisma: PrismaService) {}

  /**
   * Complete opening roll and generate dice for winner
   * 
   * ⏱️ TIMER LOGIC (CRITICAL):
   * When opening roll completes, winner's timer MUST start immediately.
   * 
   * Algorithm:
   * 1. Determine winner and loser
   * 2. Set lastDoneBy = loser (simulates opponent pressed Done)
   * 3. Set lastDoneAt = NOW (timer starts from this moment)
   * 4. This makes winner's timer start counting
   * 
   * Example:
   * - White wins opening → lastDoneBy = 'black' → white timer counts
   * - Black wins opening → lastDoneBy = 'white' → black timer counts
   * 
   * WHY:
   * Timer counting logic: lastDoneBy determines whose timer runs.
   * If lastDoneBy = 'black', white's timer counts (opponent of lastDoneBy).
   * Setting lastDoneBy = loser ensures winner's timer starts.
   * 
   * ⛔ Changing this breaks timer synchronization!
   * ⛔ Timer must start at opening, not after first move!
   */
  async completeOpeningRoll(gameId: string, winner: 'white' | 'black', firstRollDice: [number, number]) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const gameState = game.gameState as any;

    // 🎲 Use pre-generated firstRollDice for winner
    const nextPlayerDice = firstRollDice;
    
    console.log(`\n📤 [FRONTEND] Sending winner's first roll for ${winner}: [${nextPlayerDice[0]}, ${nextPlayerDice[1]}]`);

    const updatedNextRoll = {
      white: winner === 'white' ? nextPlayerDice : null,
      black: winner === 'black' ? nextPlayerDice : null,
    };

    console.log(`📋 nextRoll structure:`, JSON.stringify(updatedNextRoll));

    // ⏱️ CRITICAL: Opening roll winner's timer starts immediately!
    // ================================================================
    // When white wins opening → white plays first → white timer must count
    // To make white timer count, we set lastDoneBy = 'black' (opponent)
    // This simulates that black pressed Done, so white's turn begins
    // ================================================================
    const loser = winner === 'white' ? 'black' : 'white';

    const updatedGameState = {
      ...gameState,
      currentPlayer: winner,
      phase: 'playing',
      turnCompleted: false,
      nextRoll: updatedNextRoll,
      nextDiceRoll: nextPlayerDice,
      diceValues: [],
      lastDoneAt: new Date().toISOString(), // ⏱️ Timer starts NOW
      lastDoneBy: loser, // ⏱️ Loser "pressed Done" so winner timer counts
    };

    console.log('⏱️ Opening roll complete - Timer setup:', {
      winner,
      loser,
      lastDoneBy: loser,
      lastDoneAt: updatedGameState.lastDoneAt,
      message: `${winner} timer will start counting`,
    });

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
}
