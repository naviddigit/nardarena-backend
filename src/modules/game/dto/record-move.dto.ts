import { IsEnum, IsInt, IsBoolean, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RecordMoveDto {
  @ApiProperty({ example: 'WHITE', enum: ['WHITE', 'BLACK'] })
  @IsEnum(['WHITE', 'BLACK'])
  playerColor: 'WHITE' | 'BLACK';

  @ApiProperty({ example: 1, description: 'Sequential move number' })
  @IsInt()
  moveNumber: number;

  @ApiProperty({ example: 5, description: 'From point (0-23, -1 for bar)' })
  @IsInt()
  from: number;

  @ApiProperty({ example: 10, description: 'To point (0-23, 24 for off)' })
  @IsInt()
  to: number;

  @ApiProperty({ example: 5, description: 'Dice value used' })
  @IsInt()
  diceUsed: number;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  isHit?: boolean;

  @ApiProperty({ example: { points: [], bar: {}, off: {} }, required: false })
  @IsOptional()
  @IsObject()
  boardStateBefore?: any;

  @ApiProperty({ example: { points: [], bar: {}, off: {} }, required: false })
  @IsOptional()
  @IsObject()
  boardStateAfter?: any;

  @ApiProperty({ example: 115, required: false, description: 'Seconds remaining' })
  @IsOptional()
  @IsInt()
  timeRemaining?: number;

  @ApiProperty({ example: 2500, required: false, description: 'Milliseconds taken' })
  @IsOptional()
  @IsInt()
  moveTime?: number;
}
