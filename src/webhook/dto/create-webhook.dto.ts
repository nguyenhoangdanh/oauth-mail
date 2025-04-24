// src/webhook/dto/create-webhook.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsOptional,
  IsObject,
  IsUrl,
  IsIn,
} from 'class-validator';

export class CreateWebhookDto {
  @ApiProperty({ description: 'Webhook name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Event type to subscribe to' })
  @IsString()
  @IsIn([
    'sent',
    'delivered',
    'opened',
    'clicked',
    'bounced',
    'complained',
    'failed',
  ])
  @IsNotEmpty()
  event: string;

  @ApiProperty({ description: 'Webhook endpoint URL' })
  @IsUrl()
  @IsNotEmpty()
  endpoint: string;

  @ApiProperty({ description: 'Secret key for webhook validation' })
  @IsString()
  @IsNotEmpty()
  secret: string;

  @ApiPropertyOptional({ description: 'Custom headers to send with webhook' })
  @IsObject()
  @IsOptional()
  headers?: Record<string, string> = {};

  @ApiPropertyOptional({ description: 'Is webhook active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}
