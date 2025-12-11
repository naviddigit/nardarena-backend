import { Controller, Get, Put, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { LoginHistoryService } from '../auth/login-history.service';

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly loginHistoryService: LoginHistoryService,
  ) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser('sub') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update user profile' })
  async updateProfile(
    @CurrentUser('sub') userId: string,
    @Body() data: { displayName?: string; avatar?: string; country?: string },
  ) {
    return this.usersService.updateProfile(userId, data);
  }

  @Get('login-history')
  @ApiOperation({ summary: 'Get login history for current user' })
  async getLoginHistory(
    @CurrentUser('sub') userId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.loginHistoryService.getUserLoginHistory(userId, parsedLimit);
  }

  @Get('suspicious-activity')
  @ApiOperation({ summary: 'Check for suspicious login activity' })
  async getSuspiciousActivity(
    @CurrentUser('sub') userId: string,
    @Query('hours') hours?: string,
  ) {
    const hoursBack = hours ? parseInt(hours, 10) : 24;
    return this.loginHistoryService.getSuspiciousActivity(userId, hoursBack);
  }
}
