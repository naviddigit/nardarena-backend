import { IsNumber, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTimersDto {
  @ApiPropertyOptional({ description: 'White player remaining time in seconds' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  whiteTimeRemaining?: number;

  @ApiPropertyOptional({ description: 'Black player remaining time in seconds' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  blackTimeRemaining?: number;
}
