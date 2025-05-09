// src/auth/dto/login.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
export class DeviceInfoDto {
  @ApiProperty()
  @IsString()
  language: string;

  @ApiProperty()
  @IsString()
  screenSize: string;

  @ApiProperty()
  @IsString()
  timeZone: string;

  @ApiProperty()
  @IsString()
  userAgent: string;
}

export class SecurityInfoDto {
  @ApiProperty()
  @IsString()
  timestamp: string;

  @ApiProperty({ type: () => DeviceInfoDto })
  @ValidateNested()
  @Type(() => DeviceInfoDto)
  deviceInfo: DeviceInfoDto;
}
export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'hoangdanh54317@gmail.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'Admin@123',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;

  @ApiPropertyOptional({ type: () => SecurityInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SecurityInfoDto)
  securityInfo?: SecurityInfoDto;
}
