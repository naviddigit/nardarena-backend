import { IsEmail, IsString, MinLength, Matches, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @ApiProperty({ example: 'player123', description: 'Unique username' })
  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  username: string;

  @ApiProperty({ example: 'Player One' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiProperty({ example: 'https://example.com/avatar.jpg', required: false })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiProperty({ example: 'US', description: 'ISO country code', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'Country must be a 2-letter ISO code' })
  country?: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;
}
