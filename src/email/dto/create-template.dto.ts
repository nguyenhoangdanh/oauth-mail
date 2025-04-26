// src/email/dto/create-template.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class CreateTemplateDto {
  @ApiProperty({
    description: 'Template name (unique identifier)',
    example: 'welcome-email',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Email subject line',
    example: 'Welcome to SecureMail',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  subject?: string;

  @ApiProperty({
    description: 'Short description of the template purpose',
    example: 'Email sent to new users after registration',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Template content in Handlebars format',
    example:
      '<h1>Welcome, {{name}}!</h1><p>Thank you for joining our platform.</p>',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description: 'Whether the template is active and available for use',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    description: 'Preview text shown in email clients',
    example: 'Welcome to SecureMail! Get started with our platform.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(250)
  previewText?: string;

  @ApiProperty({
    description: 'Template category for organizational purposes',
    example: 'onboarding',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  category?: string;
}
