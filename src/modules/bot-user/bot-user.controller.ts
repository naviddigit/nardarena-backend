import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { BotUserService } from './bot-user.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('bot-users')
@UseGuards(JwtAuthGuard)
export class BotUserController {
  constructor(private readonly botUserService: BotUserService) {}

  /**
   * Generate a preview of a bot user
   * GET /bot-users/preview?country=US
   */
  @Get('preview')
  async generatePreview(@Query('country') country?: string) {
    return this.botUserService.generateBotPreview(country);
  }

  /**
   * Create a bot user from preview data
   * POST /bot-users/create
   */
  @Post('create')
  async createBotUser(@Body() preview: any) {
    return this.botUserService.createBotUser(preview);
  }

  /**
   * Generate and create a bot user in one step
   * POST /bot-users/generate?country=US
   */
  @Post('generate')
  async generateAndCreate(@Query('country') country?: string) {
    return this.botUserService.generateAndCreateBotUser(country);
  }

  /**
   * Bulk generate bot users
   * POST /bot-users/bulk
   */
  @Post('bulk')
  async bulkGenerate(
    @Body() body: { count: number; country?: string },
  ) {
    const { count, country } = body;
    if (!count || count < 1 || count > 100) {
      throw new Error('Count must be between 1 and 100');
    }
    return this.botUserService.bulkGenerateBotUsers(count, country);
  }

  /**
   * Get bot users statistics
   * GET /bot-users/stats
   */
  @Get('stats')
  async getBotUsersStats() {
    return this.botUserService.getBotUsersStats();
  }

  /**
   * Get bot users count by country
   * GET /bot-users/by-country
   */
  @Get('by-country')
  async getBotUsersByCountry() {
    return this.botUserService.getBotUsersByCountry();
  }

  /**
   * Get all bot users
   * GET /bot-users?page=1&limit=25&country=US
   */
  @Get()
  async getBotUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('country') country?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 25;
    return this.botUserService.getBotUsers(pageNum, limitNum, country);
  }

  /**
   * Check if bot user can be deleted
   * GET /bot-users/:id/can-delete
   */
  @Get(':id/can-delete')
  async canDeleteBotUser(@Param('id') id: string) {
    return this.botUserService.canDeleteBotUser(id);
  }

  /**
   * Delete a bot user
   * DELETE /bot-users/:id
   */
  @Delete(':id')
  async deleteBotUser(@Param('id') id: string) {
    return this.botUserService.deleteBotUser(id);
  }
}
