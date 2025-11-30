import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { GamesService } from './games.service';

@ApiTags('games')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get game by ID' })
  async getGame(@Param('id') gameId: string) {
    return this.gamesService.getGame(gameId);
  }

  @Post('create')
  @ApiOperation({ summary: 'Create new game' })
  async createGame(
    @CurrentUser('sub') userId: string,
    // TODO: Add opponent selection logic
  ) {
    // For now, create game with same user (testing)
    return this.gamesService.createGame(userId, userId);
  }
}
