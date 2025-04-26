// src/email/dto/update-template.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  IsNumber,
} from 'class-validator';

export class UpdateTemplateDto {
  @ApiProperty({
    description: 'Template name (unique identifier)',
    example: 'welcome-email',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiProperty({
    description: 'Email subject line',
    example: 'Welcome to SecureMail',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  subject?: string;

  @ApiProperty({
    description: 'Short description of the template purpose',
    example: 'Email sent to new users after registration',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Template content in Handlebars format',
    example:
      '<h1>Welcome, {{name}}!</h1><p>Thank you for joining our platform.</p>',
    required: false,
  })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiProperty({
    description: 'Whether the template is active and available for use',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    description: 'Template version (automatically incremented)',
    example: 2,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  version?: number;

  @ApiProperty({
    description: 'Preview text shown in email clients',
    example: 'Welcome to SecureMail! Get started with our platform.',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(250)
  previewText?: string;

  @ApiProperty({
    description: 'Template category for organizational purposes',
    example: 'onboarding',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  category?: string;
}
