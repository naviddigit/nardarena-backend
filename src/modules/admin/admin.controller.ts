import { Controller, Get, Put, Param, Query, UseGuards, Body, Post, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { DatabaseMaintenanceService } from './database-maintenance.service';

@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly databaseMaintenance: DatabaseMaintenanceService
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get platform statistics' })
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('users/by-country')
  @ApiOperation({ summary: 'Get real users count by country' })
  async getUsersByCountry() {
    return this.adminService.getUsersByCountry();
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users (paginated with search and sorting)' })
  async getUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('country') country?: string,
  ) {
    return this.adminService.getUsers(
      Number(page) || 1,
      Number(limit) || 50,
      search,
      sortBy,
      sortOrder || 'desc',
      country,
    );
  }

  @Get('games')
  @ApiOperation({ summary: 'Get all games (paginated with filters)' })
  async getGames(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('gameType') gameType?: 'AI' | 'ONLINE' | 'TOURNAMENT',
    @Query('status') status?: 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'ABANDONED',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminService.getGames(
      Number(page) || 1,
      Number(limit) || 50,
      gameType,
      status,
      startDate,
      endDate,
    );
  }

  @Put('users/:id/status')
  @ApiOperation({ summary: 'Update user status' })
  async updateUserStatus(
    @Param('id') userId: string,
    @Body('status') status: 'ACTIVE' | 'BANNED' | 'SUSPENDED',
    @CurrentUser('sub') adminId: string,
  ) {
    return this.adminService.updateUserStatus(userId, status, adminId);
  }

  @Put('users/:id/role')
  @ApiOperation({ summary: 'Update user role' })
  async updateUserRole(
    @Param('id') userId: string,
    @Body('role') role: 'USER' | 'ADMIN',
    @CurrentUser('sub') adminId: string,
  ) {
    return this.adminService.updateUserRole(userId, role, adminId);
  }

  @Put('users/:id/password')
  @ApiOperation({ summary: 'Reset user password' })
  async resetUserPassword(
    @Param('id') userId: string,
    @Body('newPassword') newPassword: string,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.adminService.resetUserPassword(userId, newPassword, adminId);
  }

  @Put('users/:id/ban')
  @ApiOperation({ summary: 'Ban user (deprecated - use status endpoint)' })
  async banUser(
    @Param('id') userId: string,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.adminService.updateUserStatus(userId, 'BANNED', adminId);
  }

  // ============================================
  // DATABASE MANAGEMENT ENDPOINTS
  // ============================================

  @Get('database/stats')
  @ApiOperation({ summary: 'Get comprehensive database statistics' })
  async getDatabaseStats() {
    return this.databaseMaintenance.getDatabaseStats();
  }

  @Get('database/recommendations')
  @ApiOperation({ summary: 'Get cleanup recommendations' })
  async getCleanupRecommendations() {
    return this.databaseMaintenance.getCleanupRecommendations();
  }

  @Post('database/cleanup-moves')
  @ApiOperation({ summary: 'Clean up old game moves (keeps moveHistory JSON)' })
  async cleanupOldGameMoves(
    @Query('olderThanDays') olderThanDays?: string,
    @Query('dryRun') dryRun?: string,
  ) {
    const days = olderThanDays ? parseInt(olderThanDays) : 10;
    const isDryRun = dryRun === 'true';
    return this.databaseMaintenance.cleanupOldGameMoves(days, isDryRun);
  }

  @Post('database/archive-games')
  @ApiOperation({ summary: 'Archive old games (removes detailed move data)' })
  async archiveOldGames(
    @Query('olderThanMonths') olderThanMonths?: string,
    @Query('dryRun') dryRun?: string,
  ) {
    const months = olderThanMonths ? parseInt(olderThanMonths) : 6;
    const isDryRun = dryRun === 'true';
    return this.databaseMaintenance.archiveOldGames(months, isDryRun);
  }

  @Delete('database/delete-old-games')
  @ApiOperation({ summary: 'Delete very old games entirely (permanent)' })
  async deleteVeryOldGames(
    @Query('olderThanMonths') olderThanMonths?: string,
    @Query('dryRun') dryRun?: string,
  ) {
    const months = olderThanMonths ? parseInt(olderThanMonths) : 12;
    const isDryRun = dryRun === 'true';
    return this.databaseMaintenance.deleteVeryOldGames(months, isDryRun);
  }

  @Post('database/optimize')
  @ApiOperation({ summary: 'Optimize database (VACUUM, ANALYZE, REINDEX)' })
  async optimizeDatabase() {
    return this.databaseMaintenance.optimizeTables();
  }
}
