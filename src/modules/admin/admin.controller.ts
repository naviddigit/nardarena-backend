import { Controller, Get, Put, Param, Query, UseGuards, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get platform statistics' })
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users (paginated with search and sorting)' })
  async getUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.adminService.getUsers(
      Number(page) || 1,
      Number(limit) || 50,
      search,
      sortBy,
      sortOrder || 'desc',
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
}
