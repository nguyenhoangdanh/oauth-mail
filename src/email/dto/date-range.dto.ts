// src/email/dto/date-range.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString } from 'class-validator';

export class DateRangeDto {
  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  start?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  end?: string;
}
