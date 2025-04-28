// src/email/dto/send-email.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsObject,
  IsArray,
  IsBoolean,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EmailOptions } from '../email.port';

// Define EmailAttachmentDto first
export class EmailAttachmentDto {
  @ApiProperty({
    description: 'File name',
    example: 'filename.txt',
  })
  @IsString()
  @IsNotEmpty()
  filename: string;

  @ApiProperty({
    description: 'Content...',
    example: 'This is content',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  contentType?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  cid?: string;
}

// Define EmailOptionsDto second
export class EmailOptionsDto implements Partial<EmailOptions> {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  from?: string;

  @ApiProperty({ required: false })
  @IsEmail({}, { each: true })
  @IsOptional()
  cc?: string | string[];

  @ApiProperty({ required: false })
  @IsEmail({}, { each: true })
  @IsOptional()
  bcc?: string | string[];

  @ApiProperty({ required: false })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => EmailAttachmentDto)
  attachments?: EmailAttachmentDto[];

  @ApiProperty({ required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  campaignId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  batchId?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  trackOpens?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  trackClicks?: boolean;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  deliveryTime?: Date;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  replyTo?: string;
}

// Define SendEmailDto last, as it depends on EmailOptionsDto
export class SendEmailDto {
  @ApiProperty({
    description: 'Recipient email address or addresses',
    example: 'hoangdanh54317@gmail.com',
  })
  @IsEmail({}, { each: true })
  @IsOptional()
  to?: string | string[];

  @ApiProperty({
    description: 'Email subject',
    example: 'Welcome to SecureMail',
  })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({
    description: 'Email template name',
    example: 'welcome',
  })
  @IsString()
  @IsNotEmpty()
  template: string;

  @ApiProperty({
    description: 'Template context variables',
    example: {
      name: 'Thanh Ngan Dang',
      activationLink: 'https://example.com/activate/token',
    },
  })
  @IsObject()
  @IsOptional()
  context?: Record<string, any>;

  @ApiProperty({
    description: 'Additional email options',
    required: false,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => EmailOptionsDto)
  options?: EmailOptionsDto;
}
