import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as bcrypt from 'bcrypt';

/**
 * Admin Service
 * Manages admin operations (user management, stats, etc.)
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get platform statistics for admin dashboard
   */
  async getStats() {
    const [
      totalUsers,
      totalGames,
      activeGames,
      completedGames,
      totalMoves,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.game.count(),
      this.prisma.game.count({ where: { status: 'ACTIVE' } }),
      this.prisma.game.count({ where: { status: 'COMPLETED' } }),
      this.prisma.gameMove.count(),
    ]);

    // Get recent users (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const newUsersThisWeek = await this.prisma.user.count({
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    // Get games by type
    const gamesByType = await this.prisma.game.groupBy({
      by: ['gameType'],
      _count: {
        id: true,
      },
    });

    return {
      totalUsers,
      totalGames,
      activeGames,
      completedGames,
      totalMoves,
      newUsersThisWeek,
      gamesByType: gamesByType.reduce((acc, item) => {
        acc[item.gameType] = item._count.id;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  /**
   * Get paginated list of users with optional search and sorting
   */
  async getUsers(
    page = 1,
    limit = 50,
    search?: string,
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'desc',
    country?: string,
  ) {
    const skip = (page - 1) * limit;

    const baseWhere: any = { isBot: false };
    
    if (country) {
      baseWhere.country = country;
    }

    const where = search
      ? {
          ...baseWhere,
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { username: { contains: search, mode: 'insensitive' as const } },
            { displayName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : baseWhere;

    // Map frontend field names to database field names
    const sortFieldMap: Record<string, string> = {
      displayName: 'displayName',
      email: 'email',
      role: 'role',
      status: 'status',
      createdAt: 'createdAt',
    };

    const orderByField = sortBy && sortFieldMap[sortBy] ? sortFieldMap[sortBy] : 'createdAt';
    const orderBy = { [orderByField]: sortOrder };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          avatar: true,
          role: true,
          status: true,
          isBot: true,
          country: true,
          createdAt: true,
          lastLoginAt: true,
          stats: {
            select: {
              gamesPlayed: true,
              gamesWon: true,
              currentStreak: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get real users count by country
   */
  async getUsersByCountry() {
    const users = await this.prisma.user.findMany({
      where: { isBot: false },
      select: { country: true },
    });

    const countByCountry = users.reduce((acc: Record<string, number>, user) => {
      const country = user.country || 'UNKNOWN';
      acc[country] = (acc[country] || 0) + 1;
      return acc;
    }, {});

    return countByCountry;
  }

  /**
   * Get paginated list of games with filters
   */
  async getGames(
    page = 1,
    limit = 50,
    gameType?: 'AI' | 'ONLINE' | 'TOURNAMENT',
    status?: 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'ABANDONED',
    startDate?: string,
    endDate?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (gameType) {
      where.gameType = gameType;
    }
    
    if (status) {
      where.status = status;
    }
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const [games, total] = await Promise.all([
      this.prisma.game.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
          _count: {
            select: {
              moves: true,
            },
          },
        },
      }),
      this.prisma.game.count({ where }),
    ]);

    return {
      games,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update user status (activate/ban/suspend)
   * SECURITY: Prevent admin from being banned or suspended
   */
  async updateUserStatus(userId: string, status: 'ACTIVE' | 'BANNED' | 'SUSPENDED', adminId: string) {
    // SECURITY: Check if target user is admin
    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (targetUser?.role === 'ADMIN' && status !== 'ACTIVE') {
      throw new Error('Cannot ban or suspend admin user. This would compromise system security.');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { status },
    });

    this.logger.log(`User ${userId} status changed to ${status} by admin ${adminId}`);

    return updatedUser;
  }

  /**
   * Update user role
   * SECURITY: Prevent anyone from becoming admin - only demote admin to user
   */
  async updateUserRole(userId: string, role: 'USER' | 'ADMIN', adminId: string) {
    // SECURITY: Prevent promoting users to admin
    if (role === 'ADMIN') {
      throw new Error('Cannot promote users to admin role. Only one admin should exist.');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    this.logger.log(`User ${userId} role changed to ${role} by admin ${adminId}`);

    return updatedUser;
  }

  /**
   * Reset user password
   */
  async resetUserPassword(userId: string, newPassword: string, adminId: string) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await this.prisma.user.update({
      where: { id: userId },
      data: { 
        passwordHash: hashedPassword,
        forcePasswordChange: false,
        updatedAt: new Date(),
      },
      select: { id: true },
    });

    this.logger.log(`User ${userId} password reset by admin ${adminId}`);

    return { message: 'Password reset successfully' };
  }
}
