// src/webhook/dto/update-webhook.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsUrl,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsObject,
  IsIn,
  MaxLength,
} from 'class-validator';

export class UpdateWebhookDto {
  @ApiProperty({
    description: 'Webhook name',
    example: 'Email Notifications',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiProperty({
    description: 'Event to subscribe to',
    example: 'email.sent',
    required: false,
  })
  @IsString()
  @IsOptional()
  event?: string;

  @ApiProperty({
    description: 'URL endpoint to deliver webhook events',
    example: 'https://example.com/webhooks/email',
    required: false,
  })
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
  })
  @IsOptional()
  endpoint?: string;

  @ApiProperty({
    description: 'Secret used to sign webhook payloads',
    example: 'your-webhook-secret-key',
    required: false,
  })
  @IsString()
  @IsOptional()
  secret?: string;

  @ApiProperty({
    description: 'Whether the webhook is active',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    description: 'Max number of retry attempts',
    example: 5,
    required: false,
  })
  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  maxRetries?: number;

  @ApiProperty({
    description: 'Timeout in seconds for webhook delivery',
    example: 30,
    required: false,
  })
  @IsInt()
  @Min(5)
  @Max(60)
  @IsOptional()
  timeout?: number;

  @ApiProperty({
    description: 'HTTP method to use for delivery',
    example: 'POST',
    enum: ['POST', 'PUT', 'PATCH'],
    required: false,
  })
  @IsString()
  @IsIn(['POST', 'PUT', 'PATCH'])
  @IsOptional()
  method?: string;

  @ApiProperty({
    description: 'Additional HTTP headers to include',
    example: { 'X-Custom-Header': 'value' },
    required: false,
  })
  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  @ApiProperty({
    description: 'Description of webhook purpose',
    example: 'Notify our CRM when emails are opened',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Additional metadata for the webhook',
    example: { integrationId: '123', tags: ['production'] },
    required: false,
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
