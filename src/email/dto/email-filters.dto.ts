// src/email/dto/email-filters.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum EmailStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SENT = 'sent',
  DELIVERED = 'delivered',
  OPENED = 'opened',
  CLICKED = 'clicked',
  BOUNCED = 'bounced',
  FAILED = 'failed',
  COMPLAINED = 'complained',
}

export class EmailFiltersDto {
  @ApiPropertyOptional({
    description: 'Page number',
    default: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    default: 20,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  limit: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by email status',
    enum: EmailStatus,
  })
  @IsEnum(EmailStatus)
  @IsOptional()
  status?: EmailStatus;

  @ApiPropertyOptional({
    description: 'Filter by template name',
  })
  @IsString()
  @IsOptional()
  template?: string;

  @ApiPropertyOptional({
    description: 'Search by recipient email',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by start date (ISO format)',
  })
  @IsDateString()
  @IsOptional()
  start?: string;

  @ApiPropertyOptional({
    description: 'Filter by end date (ISO format)',
  })
  @IsDateString()
  @IsOptional()
  end?: string;

  @ApiPropertyOptional({
    description: 'Filter by campaign ID',
  })
  @IsString()
  @IsOptional()
  campaignId?: string;

  @ApiPropertyOptional({
    description: 'Filter by user ID',
  })
  @IsString()
  @IsOptional()
  userId?: string;
}

// src/email/dto/date-range.dto.ts
export class DateRangeDto {
  @ApiPropertyOptional({
    description: 'Start date (ISO format)',
  })
  @IsDateString()
  @IsOptional()
  start?: string;

  @ApiPropertyOptional({
    description: 'End date (ISO format)',
  })
  @IsDateString()
  @IsOptional()
  end?: string;
}
