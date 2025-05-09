// src/auth/dto/account-status.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class AccountStatusDto {
  @ApiProperty({
    description: 'Account active status',
    example: true,
  })
  @IsBoolean()
  isActive: boolean;
}
