// src/auth/dto/reset-password.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SecurityInfoDto } from './login.dto';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Reset password token',
    example: 'a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6',
  })
  @IsString()
  token: string;

  @ApiProperty({
    description: 'New user password',
    example: 'NewP@ssword123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password: string;

  @ApiPropertyOptional({ type: () => SecurityInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SecurityInfoDto)
  securityInfo?: SecurityInfoDto;
}
