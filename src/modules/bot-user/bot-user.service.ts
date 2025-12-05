import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as bcrypt from 'bcrypt';
import {
  BOT_FIRST_NAMES,
  BOT_LAST_NAMES,
  COUNTRIES,
  AVATAR_OPTIONS,
  generateUsername,
  generatePassword,
  getRandomItem,
} from 'src/common/data/bot-user-data';

export interface GenerateBotUserDto {
  country?: string; // Optional: specify country, otherwise random
  preview?: boolean; // If true, return preview without creating
}

export interface BotUserPreview {
  firstName: string;
  lastName: string;
  displayName: string;
  username: string;
  email: string;
  password: string;
  country: string;
  countryName: string;
  avatar: string;
}

@Injectable()
export class BotUserService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate a preview of a bot user without creating it
   */
  async generateBotPreview(country?: string): Promise<BotUserPreview> {
    const selectedCountry = country
      ? COUNTRIES.find((c) => c.code === country)
      : getRandomItem(COUNTRIES);

    if (!selectedCountry) {
      throw new Error('Invalid country code');
    }

    const countryCode = selectedCountry.code as keyof typeof BOT_FIRST_NAMES;
    const firstName = getRandomItem(BOT_FIRST_NAMES[countryCode]);
    const lastName = getRandomItem(BOT_LAST_NAMES[countryCode]);
    const displayName = `${firstName} ${lastName}`;
    const username = await this.generateUniqueUsername(firstName, lastName);
    const email = `${username}@nardarena.com`;
    const password = generatePassword();
    const avatar = getRandomItem(AVATAR_OPTIONS);

    return {
      firstName,
      lastName,
      displayName,
      username,
      email,
      password,
      country: selectedCountry.code,
      countryName: selectedCountry.name,
      avatar,
    };
  }

  /**
   * Create a bot user in the database
   */
  async createBotUser(preview: BotUserPreview) {
    // Hash password
    const passwordHash = await bcrypt.hash(preview.password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: preview.email,
        username: preview.username,
        displayName: preview.displayName,
        passwordHash,
        avatar: preview.avatar,
        country: preview.country,
        isBot: true,
        emailVerified: true, // Bots are auto-verified
        status: 'ACTIVE',
      },
    });

    // Create user stats
    await this.prisma.userStats.create({
      data: {
        userId: user.id,
      },
    });

    return {
      user,
      credentials: {
        email: preview.email,
        password: preview.password,
      },
    };
  }

  /**
   * Generate and create a bot user in one step
   */
  async generateAndCreateBotUser(country?: string) {
    const preview = await this.generateBotPreview(country);
    return this.createBotUser(preview);
  }

  /**
   * Generate a unique username
   */
  private async generateUniqueUsername(
    firstName: string,
    lastName: string,
  ): Promise<string> {
    let username = generateUsername(firstName, lastName);
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const existing = await this.prisma.user.findUnique({
        where: { username },
      });

      if (!existing) {
        return username;
      }

      // Add random numbers if username exists
      username = generateUsername(firstName, lastName);
      attempts++;
    }

    // Fallback: add timestamp
    return `${username}_${Date.now()}`;
  }

  /**
   * Get all bot users with optional country filter
   */
  async getBotUsers(page = 1, limit = 25, country?: string) {
    const skip = (page - 1) * limit;

    const where = country ? { isBot: true, country } : { isBot: true };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
          avatar: true,
          country: true,
          status: true,
          createdAt: true,
          stats: {
            select: {
              gamesPlayed: true,
              gamesWon: true,
              gamesLost: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      botUsers: users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get bot users count by country
   */
  async getBotUsersByCountry() {
    const bots = await this.prisma.user.findMany({
      where: { isBot: true },
      select: { country: true },
    });

    const countByCountry = bots.reduce((acc: Record<string, number>, bot) => {
      const country = bot.country || 'UNKNOWN';
      acc[country] = (acc[country] || 0) + 1;
      return acc;
    }, {});

    return countByCountry;
  }

  /**
   * Check if bot user can be deleted (no game history)
   */
  async canDeleteBotUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        stats: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isBot) {
      throw new Error('Not a bot user');
    }

    const hasGameHistory = user.stats && user.stats.gamesPlayed > 0;

    return {
      canDelete: !hasGameHistory,
      user: {
        id: user.id,
        displayName: user.displayName,
        username: user.username,
        avatar: user.avatar,
      },
      gameHistory: {
        gamesPlayed: user.stats?.gamesPlayed || 0,
        gamesWon: user.stats?.gamesWon || 0,
        gamesLost: user.stats?.gamesLost || 0,
      },
      message: hasGameHistory
        ? 'Cannot delete bot user with game history'
        : 'Bot user can be deleted',
    };
  }

  /**
   * Delete a bot user (only if no game history)
   */
  async deleteBotUser(userId: string) {
    const checkResult = await this.canDeleteBotUser(userId);

    if (!checkResult.canDelete) {
      throw new Error(checkResult.message);
    }

    await this.prisma.user.delete({
      where: { id: userId },
    });

    return { success: true, message: 'Bot user deleted successfully' };
  }

  /**
   * Get bot users statistics
   */
  async getBotUsersStats() {
    const [totalBots, activeBots, inactiveBots, totalGames] = await Promise.all([
      this.prisma.user.count({ where: { isBot: true } }),
      this.prisma.user.count({ where: { isBot: true, status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { isBot: true, status: 'SUSPENDED' } }),
      this.prisma.user.findMany({
        where: { isBot: true },
        include: { stats: true },
      }),
    ]);

    const stats = totalGames.reduce(
      (acc, bot) => ({
        totalGames: acc.totalGames + (bot.stats?.gamesPlayed || 0),
        totalWins: acc.totalWins + (bot.stats?.gamesWon || 0),
        totalLosses: acc.totalLosses + (bot.stats?.gamesLost || 0),
      }),
      { totalGames: 0, totalWins: 0, totalLosses: 0 }
    );

    return {
      totalBots,
      activeBots,
      inactiveBots,
      ...stats,
      winRate: stats.totalGames > 0 ? (stats.totalWins / stats.totalGames) * 100 : 0,
    };
  }

  /**
   * Bulk generate bot users
   */
  async bulkGenerateBotUsers(count: number, country?: string) {
    const results = [];

    for (let i = 0; i < count; i++) {
      try {
        const result = await this.generateAndCreateBotUser(country);
        results.push(result);
      } catch (error) {
        console.error(`Failed to create bot user ${i + 1}:`, error);
      }
    }

    return {
      created: results.length,
      failed: count - results.length,
      users: results,
    };
  }
}
