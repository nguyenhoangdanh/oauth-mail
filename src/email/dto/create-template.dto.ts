// src/email/dto/create-template.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsBoolean, IsOptional } from 'class-validator';

export class CreateTemplateDto {
  @ApiProperty({ description: 'Template name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Template content in Handlebars format' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: 'Template description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Template format (html, text)' })
  @IsString()
  @IsOptional()
  format?: string = 'html';

  @ApiPropertyOptional({ description: 'Is template active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}
