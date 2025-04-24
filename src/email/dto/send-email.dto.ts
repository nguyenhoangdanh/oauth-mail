// src/email/dto/send-email.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsObject,
  IsNumber,
  IsArray,
  ValidateNested,
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  delay?: number;
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

// Define a recipient sub-class for type validation
class RecipientDto {
  @ApiProperty({ description: 'Recipient email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ description: 'Optional recipient name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Optional recipient-specific context' })
  @IsObject()
  @IsOptional()
  context?: Record<string, any>;
}

export class BulkEmailDto {
  @ApiProperty({ description: 'List of recipients', type: [RecipientDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipientDto)
  recipients: RecipientDto[];

  @ApiProperty({ description: 'Email subject' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ description: 'Email template name to use' })
  @IsString()
  @IsNotEmpty()
  template: string;

  @ApiPropertyOptional({ description: 'Global template context data' })
  @IsObject()
  @IsOptional()
  context?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Campaign ID for tracking' })
  @IsString()
  @IsOptional()
  campaignId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  delay?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  batchSize?: number;
}