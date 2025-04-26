// src/webhook/dto/webhook-delivery-log.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WebhookDeliveryLogDto {
  @ApiProperty({ description: 'Delivery log ID' })
  id: string;

  @ApiProperty({ description: 'Associated webhook ID' })
  webhookId: string;

  @ApiProperty({ description: 'Event type that triggered the webhook' })
  event: string;

  @ApiProperty({ description: 'Webhook payload (JSON)' })
  payload: Record<string, any>;

  @ApiProperty({ description: 'Delivery attempt number' })
  attempt: number;

  @ApiProperty({
    description: 'Current status of the delivery',
    enum: ['pending', 'success', 'failed'],
  })
  status: 'pending' | 'success' | 'failed';

  @ApiPropertyOptional({
    description: 'HTTP status code returned by the endpoint',
  })
  statusCode?: number;

  @ApiPropertyOptional({ description: 'Response body from the endpoint' })
  response?: string;

  @ApiPropertyOptional({ description: 'Error message if delivery failed' })
  error?: string;

  @ApiPropertyOptional({ description: 'Delivery duration in milliseconds' })
  duration?: number;

  @ApiProperty({ description: 'Time when the delivery log was created' })
  createdAt: Date;

  @ApiPropertyOptional({ description: 'Time when the delivery was completed' })
  completedAt?: Date;

  @ApiPropertyOptional({ description: 'Related email ID' })
  emailId?: string;
}

export class PaginatedWebhookDeliveryLogsDto {
  @ApiProperty({ type: [WebhookDeliveryLogDto] })
  data: WebhookDeliveryLogDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: 'object',
    properties: {
      total: { type: 'number', description: 'Total number of logs' },
      page: { type: 'number', description: 'Current page number' },
      limit: { type: 'number', description: 'Items per page' },
      pages: { type: 'number', description: 'Total number of pages' },
    },
  })
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}
