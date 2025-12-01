import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

interface DatabaseStats {
  totalSize: string;
  tables: Array<{
    name: string;
    rowCount: number;
    sizeBytes: number;
    sizeFormatted: string;
  }>;
  oldGamesCount: number;
  oldMovesCount: number;
  archivableGamesCount: number;
  deletableMovesCount: number;
}

interface ArchiveResult {
  gamesArchived: number;
  movesDeleted: number;
  spaceSaved: string;
}

@Injectable()
export class DatabaseMaintenanceService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get comprehensive database statistics
   */
  async getDatabaseStats(): Promise<DatabaseStats> {
    // Get database size
    const sizeResult = await this.prisma.$queryRaw<Array<{ size: string }>>`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `;

    // Get table sizes and row counts
    const tables = await this.prisma.$queryRaw<
      Array<{
        tablename: string;
        row_count: bigint;
        total_bytes: bigint;
      }>
    >`
      SELECT 
        t.schemaname || '.' || t.relname AS tablename,
        t.n_live_tup AS row_count,
        pg_total_relation_size(quote_ident(t.schemaname) || '.' || quote_ident(t.relname)) AS total_bytes
      FROM pg_stat_user_tables t
      WHERE t.schemaname = 'public'
      ORDER BY total_bytes DESC
    `;

    // Count old games (>6 months)
    const oldGamesCount = await this.prisma.game.count({
      where: {
        endedAt: {
          lt: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000),
        },
        status: 'COMPLETED',
      },
    });

    // Count old game moves (games >3 months)
    const oldMovesCount = await this.prisma.gameMove.count({
      where: {
        game: {
          endedAt: {
            lt: new Date(Date.now() - 3 * 30 * 24 * 60 * 60 * 1000),
          },
          status: 'COMPLETED',
        },
      },
    });

    // Count archivable games (completed, >6 months)
    const archivableGamesCount = await this.prisma.game.count({
      where: {
        endedAt: {
          lt: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000),
        },
        status: 'COMPLETED',
      },
    });

    // Count deletable moves (games >3 months)
    const deletableMovesCount = await this.prisma.gameMove.count({
      where: {
        game: {
          endedAt: {
            lt: new Date(Date.now() - 3 * 30 * 24 * 60 * 60 * 1000),
          },
          status: 'COMPLETED',
        },
      },
    });

    return {
      totalSize: sizeResult[0].size,
      tables: tables.map((t) => ({
        name: t.tablename,
        rowCount: Number(t.row_count),
        sizeBytes: Number(t.total_bytes),
        sizeFormatted: this.formatBytes(Number(t.total_bytes)),
      })),
      oldGamesCount,
      oldMovesCount,
      archivableGamesCount,
      deletableMovesCount,
    };
  }

  /**
   * Archive old games and clean up detailed moves
   * Called manually or via cron job
   */
  async archiveOldGames(
    olderThanMonths: number = 6,
    dryRun: boolean = false
  ): Promise<ArchiveResult> {
    const cutoffDate = new Date(Date.now() - olderThanMonths * 30 * 24 * 60 * 60 * 1000);

    // Find games to archive
    const gamesToArchive = await this.prisma.game.findMany({
      where: {
        endedAt: { lt: cutoffDate },
        status: 'COMPLETED',
      },
      select: { id: true },
    });

    const gameIds = gamesToArchive.map((g) => g.id);

    if (dryRun) {
      // Just count what would be deleted
      const movesCount = await this.prisma.gameMove.count({
        where: { gameId: { in: gameIds } },
      });

      return {
        gamesArchived: 0,
        movesDeleted: 0,
        spaceSaved: `Would delete ${movesCount} moves from ${gameIds.length} games`,
      };
    }

    // Delete detailed moves (moveHistory JSON is kept in Game table)
    const deleteResult = await this.prisma.gameMove.deleteMany({
      where: { gameId: { in: gameIds } },
    });

    // Vacuum to reclaim space
    await this.prisma.$executeRaw`VACUUM ANALYZE game_moves`;

    return {
      gamesArchived: gameIds.length,
      movesDeleted: deleteResult.count,
      spaceSaved: `Estimated ${this.formatBytes(deleteResult.count * 500)}`,
    };
  }

  /**
   * Clean up old game moves (keep only moveHistory JSON)
   * For games older than 10 days (default)
   */
  async cleanupOldGameMoves(
    olderThanDays: number = 10,
    dryRun: boolean = false
  ): Promise<ArchiveResult> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    // Find completed games older than cutoff
    const oldGames = await this.prisma.game.findMany({
      where: {
        endedAt: { lt: cutoffDate },
        status: 'COMPLETED',
      },
      select: { id: true },
    });

    const gameIds = oldGames.map((g) => g.id);

    // Count moves to be deleted
    const movesCount = await this.prisma.gameMove.count({
      where: { gameId: { in: gameIds } },
    });

    if (dryRun) {
      return {
        gamesArchived: gameIds.length,
        movesDeleted: movesCount,
        spaceSaved: `Would free up ~${this.formatBytes(movesCount * 500)}`,
      };
    }

    // Delete the moves
    const deleteResult = await this.prisma.gameMove.deleteMany({
      where: { gameId: { in: gameIds } },
    });

    // Vacuum to reclaim space
    await this.prisma.$executeRaw`VACUUM ANALYZE game_moves`;

    return {
      gamesArchived: gameIds.length,
      movesDeleted: deleteResult.count,
      spaceSaved: this.formatBytes(deleteResult.count * 500),
    };
  }

  /**
   * Delete very old completed games entirely
   * For games older than 1 year
   */
  async deleteVeryOldGames(
    olderThanMonths: number = 12,
    dryRun: boolean = false
  ): Promise<{ deleted: number; spaceSaved: string }> {
    const cutoffDate = new Date(Date.now() - olderThanMonths * 30 * 24 * 60 * 60 * 1000);

    const oldGames = await this.prisma.game.count({
      where: {
        endedAt: { lt: cutoffDate },
        status: 'COMPLETED',
      },
    });

    if (dryRun) {
      return {
        deleted: oldGames,
        spaceSaved: `Would delete ${oldGames} games`,
      };
    }

    // Delete games (cascade will delete moves too)
    const result = await this.prisma.game.deleteMany({
      where: {
        endedAt: { lt: cutoffDate },
        status: 'COMPLETED',
      },
    });

    // Vacuum
    await this.prisma.$executeRaw`VACUUM ANALYZE games`;

    return {
      deleted: result.count,
      spaceSaved: this.formatBytes(result.count * 10000), // Rough estimate
    };
  }

  /**
   * Optimize database tables
   */
  async optimizeTables(): Promise<{ message: string }> {
    // Vacuum and analyze all tables
    await this.prisma.$executeRaw`VACUUM ANALYZE`;

    // Reindex
    await this.prisma.$executeRaw`REINDEX DATABASE nardarena`;

    return {
      message: 'Database optimized: vacuum, analyze, and reindex completed',
    };
  }

  /**
   * Get cleanup recommendations
   */
  async getCleanupRecommendations(): Promise<{
    recommendations: Array<{
      action: string;
      description: string;
      estimatedSpaceSaved: string;
      risk: 'low' | 'medium' | 'high';
    }>;
  }> {
    const stats = await this.getDatabaseStats();

    const recommendations = [];

    // Check for deletable moves
    if (stats.deletableMovesCount > 10000) {
      recommendations.push({
        action: 'cleanup_old_moves',
        description: `Delete ${stats.deletableMovesCount.toLocaleString()} detailed game moves older than 3 months`,
        estimatedSpaceSaved: this.formatBytes(stats.deletableMovesCount * 500),
        risk: 'low' as const,
      });
    }

    // Check for archivable games
    if (stats.archivableGamesCount > 1000) {
      recommendations.push({
        action: 'archive_old_games',
        description: `Archive ${stats.archivableGamesCount.toLocaleString()} games older than 6 months`,
        estimatedSpaceSaved: this.formatBytes(stats.archivableGamesCount * 10000),
        risk: 'medium' as const,
      });
    }

    // Check table sizes
    const gamesTable = stats.tables.find((t) => t.name.includes('games'));
    if (gamesTable && gamesTable.sizeBytes > 1000000000) {
      // > 1GB
      recommendations.push({
        action: 'optimize_database',
        description: 'Run VACUUM and REINDEX to optimize database',
        estimatedSpaceSaved: 'Variable (typically 10-30%)',
        risk: 'low' as const,
      });
    }

    return { recommendations };
  }

  /**
   * Automated monthly cleanup (runs on 1st of each month at 3 AM)
   */
  @Cron('0 3 * * *')
  async dailyCleanup() {
    console.log('[Cron] Starting daily database cleanup...');

    try {
      // Clean up moves older than 10 days
      const movesResult = await this.cleanupOldGameMoves(10, false);
      console.log(`[Cron] Cleaned up ${movesResult.movesDeleted} old game moves`);

      // Archive games older than 6 months
      const archiveResult = await this.archiveOldGames(6, false);
      console.log(`[Cron] Archived ${archiveResult.gamesArchived} old games`);

      // Optimize database
      await this.optimizeTables();
      console.log('[Cron] Database optimized');

      console.log('[Cron] Daily cleanup completed successfully');
    } catch (error) {
      console.error('[Cron] Daily cleanup failed:', error);
    }
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}
