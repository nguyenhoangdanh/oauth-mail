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
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  filename: string;

  @ApiProperty()
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
    example: 'user@example.com',
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
      name: 'John Doe',
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

// // src/email/dto/send-email.dto.ts
// import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// import { Type } from 'class-transformer';
// import {
//   IsEmail,
//   IsNotEmpty,
//   IsString,
//   IsOptional,
//   IsObject,
//   IsNumber,
//   IsArray,
//   ValidateNested,
// } from 'class-validator';

// export class SendEmailDto {
//   @ApiProperty({ description: 'Email recipient address' })
//   @IsEmail()
//   @IsNotEmpty()
//   to: string;

//   @ApiProperty({ description: 'Email subject' })
//   @IsString()
//   @IsNotEmpty()
//   subject: string;

//   @ApiProperty({ description: 'Email template name to use' })
//   @IsString()
//   @IsNotEmpty()
//   template: string;

//   @ApiProperty({ description: 'Template context data' })
//   @IsObject()
//   @IsNotEmpty()
//   context: Record<string, any>;

//   @ApiPropertyOptional({ description: 'Optional name of recipient' })
//   @IsString()
//   @IsOptional()
//   name?: string;

//   @ApiPropertyOptional()
//   @IsOptional()
//   @IsNumber()
//   priority?: number;

//   @ApiPropertyOptional()
//   @IsOptional()
//   @IsNumber()
//   delay?: number;
// }

// export class VerificationEmailDto {
//   @ApiProperty({ description: 'Email recipient address' })
//   @IsEmail()
//   @IsNotEmpty()
//   to: string;

//   @ApiPropertyOptional({ description: 'Optional name of recipient' })
//   @IsString()
//   @IsOptional()
//   name?: string;

//   @ApiProperty({ description: 'Verification token' })
//   @IsString()
//   @IsNotEmpty()
//   token: string;
// }

// export class PasswordResetEmailDto {
//   @ApiProperty({ description: 'Email recipient address' })
//   @IsEmail()
//   @IsNotEmpty()
//   to: string;

//   @ApiPropertyOptional({ description: 'Optional name of recipient' })
//   @IsString()
//   @IsOptional()
//   name?: string;

//   @ApiProperty({ description: 'Password reset token' })
//   @IsString()
//   @IsNotEmpty()
//   token: string;
// }

// // Define a recipient sub-class for type validation
// class RecipientDto {
//   @ApiProperty({ description: 'Recipient email address' })
//   @IsEmail()
//   @IsNotEmpty()
//   email: string;

//   @ApiPropertyOptional({ description: 'Optional recipient name' })
//   @IsString()
//   @IsOptional()
//   name?: string;

//   @ApiPropertyOptional({ description: 'Optional recipient-specific context' })
//   @IsObject()
//   @IsOptional()
//   context?: Record<string, any>;
// }

// export class BulkEmailDto {
//   @ApiProperty({ description: 'List of recipients', type: [RecipientDto] })
//   @IsArray()
//   @ValidateNested({ each: true })
//   @Type(() => RecipientDto)
//   recipients: RecipientDto[];

//   @ApiProperty({ description: 'Email subject' })
//   @IsString()
//   @IsNotEmpty()
//   subject: string;

//   @ApiProperty({ description: 'Email template name to use' })
//   @IsString()
//   @IsNotEmpty()
//   template: string;

//   @ApiPropertyOptional({ description: 'Global template context data' })
//   @IsObject()
//   @IsOptional()
//   context?: Record<string, any>;

//   @ApiPropertyOptional({ description: 'Campaign ID for tracking' })
//   @IsString()
//   @IsOptional()
//   campaignId?: string;

//   @ApiPropertyOptional()
//   @IsOptional()
//   @IsNumber()
//   priority?: number;

//   @ApiPropertyOptional()
//   @IsOptional()
//   @IsNumber()
//   delay?: number;

//   @ApiPropertyOptional()
//   @IsOptional()
//   @IsNumber()
//   batchSize?: number;
// }

// export class WelcomeEmailDto {
//   @ApiProperty({
//     description: 'Email address of the recipient',
//     example: 'user@example.com',
//   })
//   @IsEmail()
//   to: string;

//   @ApiPropertyOptional({
//     description: 'Name of the recipient',
//     example: 'John Doe',
//   })
//   @IsString()
//   @IsOptional()
//   name?: string;
// }
