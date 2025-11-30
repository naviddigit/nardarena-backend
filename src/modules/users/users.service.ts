import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

/**
 * Users Service
 * Manages user profiles and statistics
 * Follows SOLID: Single Responsibility
 */
@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get user profile with stats
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatar: true,
        country: true,
        status: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        lastLoginAt: true,
        stats: {
          select: {
            gamesPlayed: true,
            gamesWon: true,
            gamesLost: true,
            totalSetsWon: true,
            totalSetsLost: true,
            currentStreak: true,
            bestStreak: true,
            balance: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Calculate win rate
    const winRate =
      user.stats && user.stats.gamesPlayed > 0
        ? (user.stats.gamesWon / user.stats.gamesPlayed) * 100
        : 0;

    return {
      ...user,
      stats: user.stats ? {
        ...user.stats,
        winRate: parseFloat(winRate.toFixed(2)),
      } : null,
    };
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    data: { displayName?: string; avatar?: string; country?: string },
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatar: true,
        country: true,
      },
    });
  }

  /**
   * Get user by username (for search)
   */
  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: {
        id: true,
        username: true,
        displayName: true,
        stats: {
          select: {
            gamesPlayed: true,
            gamesWon: true,
          },
        },
      },
    });
  }
}
