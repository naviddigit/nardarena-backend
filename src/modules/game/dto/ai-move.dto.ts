import { IsEnum, IsArray, ValidateNested, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { AIDifficulty } from '../ai/ai-player.service';

class PointState {
  white: number;
  black: number;
}

class BarState {
  white: number;
  black: number;
}

class OffState {
  white: number;
  black: number;
}

export class AIMoveRequestDto {
  @ValidateNested({ each: true })
  @Type(() => PointState)
  @IsArray()
  points: PointState[];

  @ValidateNested()
  @Type(() => BarState)
  bar: BarState;

  @ValidateNested()
  @Type(() => OffState)
  off: OffState;

  @IsString()
  currentPlayer: 'white' | 'black';

  @IsArray()
  diceRoll: [number, number];

  @IsEnum(AIDifficulty)
  difficulty: AIDifficulty;
}

export class AIMoveResponseDto {
  moves: Array<{
    from: number;
    to: number;
  }>;
  score?: number;
  reasoning?: string;
}
