// src/auth/dto/disable-two-factor.dto.ts
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DisableTwoFactorDto {
  @ApiProperty({
    description: 'Current password for security verification',
    example: 'yourSecurePassword123',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password: string;
}
