import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsOptional, IsArray } from 'class-validator';

export class SyncStateDto {
  @ApiProperty({ 
    description: 'Current game state to sync',
    example: {
      points: [],
      bar: { white: 0, black: 0 },
      off: { white: 0, black: 0 },
      currentPlayer: 'black',
      phase: 'moving',
    }
  })
  @IsObject()
  gameState: any;

  @ApiProperty({ 
    description: 'Current dice values (if any)',
    example: [3, 5],
    required: false
  })
  @IsOptional()
  @IsArray()
  diceValues?: number[];
}
