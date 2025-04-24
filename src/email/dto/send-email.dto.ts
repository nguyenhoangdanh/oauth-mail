// src/email/dto/send-email.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsObject,
} from 'class-validator';

export class SendEmailDto {
  @ApiProperty({ description: 'Email recipient address' })
  @IsEmail()
  @IsNotEmpty()
  to: string;

  @ApiProperty({ description: 'Email subject' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ description: 'Email template name to use' })
  @IsString()
  @IsNotEmpty()
  template: string;

  @ApiProperty({ description: 'Template context data' })
  @IsObject()
  @IsNotEmpty()
  context: Record<string, any>;

  @ApiPropertyOptional({ description: 'Optional name of recipient' })
  @IsString()
  @IsOptional()
  name?: string;
}

export class VerificationEmailDto {
  @ApiProperty({ description: 'Email recipient address' })
  @IsEmail()
  @IsNotEmpty()
  to: string;

  @ApiPropertyOptional({ description: 'Optional name of recipient' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Verification token' })
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class PasswordResetEmailDto {
  @ApiProperty({ description: 'Email recipient address' })
  @IsEmail()
  @IsNotEmpty()
  to: string;

  @ApiPropertyOptional({ description: 'Optional name of recipient' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Password reset token' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
