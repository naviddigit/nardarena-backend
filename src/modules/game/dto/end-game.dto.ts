import { IsEnum, IsInt, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EndGameDto {
  @ApiProperty({ example: 'WHITE', enum: ['WHITE', 'BLACK'] })
  @IsEnum(['WHITE', 'BLACK'])
  winner: 'WHITE' | 'BLACK';

  @ApiProperty({ example: 5 })
  @IsInt()
  whiteSetsWon: number;

  @ApiProperty({ example: 3 })
  @IsInt()
  blackSetsWon: number;

  @ApiProperty({ 
    example: 'NORMAL_WIN', 
    enum: ['NORMAL_WIN', 'RESIGNATION', 'TIMEOUT', 'ABANDONMENT', 'ADMIN_CANCELLED'],
    required: false
  })
  @IsOptional()
  @IsEnum(['NORMAL_WIN', 'RESIGNATION', 'TIMEOUT', 'ABANDONMENT', 'ADMIN_CANCELLED'])
  endReason?: 'NORMAL_WIN' | 'RESIGNATION' | 'TIMEOUT' | 'ABANDONMENT' | 'ADMIN_CANCELLED';

  @ApiProperty({ example: { finalBoard: {} }, required: false })
  @IsOptional()
  @IsObject()
  finalGameState?: any;
}
