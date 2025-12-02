import { IsEnum, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateGameDto {
  @ApiProperty({ 
    example: 'AI', 
    enum: ['AI', 'ONLINE', 'TOURNAMENT'],
    description: 'Type of game'
  })
  @IsEnum(['AI', 'ONLINE', 'TOURNAMENT'])
  gameType: 'AI' | 'ONLINE' | 'TOURNAMENT';

  @ApiProperty({ 
    example: 'MEDIUM',
    enum: ['EASY', 'MEDIUM', 'HARD', 'EXPERT'],
    required: false,
    description: 'AI difficulty level (only for AI games)'
  })
  @IsOptional()
  @IsEnum(['EASY', 'MEDIUM', 'HARD', 'EXPERT'])
  aiDifficulty?: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';

  @ApiProperty({ 
    example: 'uuid-of-black-player', 
    required: false,
    description: 'ID of opponent (for ONLINE games). For AI games, system will assign AI player.'
  })
  @IsOptional()
  @IsString()
  opponentId?: string;

  @ApiProperty({ example: 120, required: false, description: 'Time control in seconds per player' })
  @IsOptional()
  @IsInt()
  @Min(30)
  timeControl?: number;

  @ApiProperty({ 
    example: 'CLASSIC', 
    enum: ['CLASSIC', 'MODERN', 'TOURNAMENT'],
    required: false 
  })
  @IsOptional()
  @IsEnum(['CLASSIC', 'MODERN', 'TOURNAMENT'])
  gameMode?: 'CLASSIC' | 'MODERN' | 'TOURNAMENT';
}
