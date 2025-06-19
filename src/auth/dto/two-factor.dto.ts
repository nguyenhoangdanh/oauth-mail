// src/auth/dto/two-factor.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
} from 'class-validator';

export class EnableTwoFactorDto {
  @ApiProperty({
    description: 'User password for verification',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class VerifyTwoFactorDto {
  @ApiProperty({
    description: 'One-time password from authenticator app',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  otp: string;
}

export class VerifyTwoFactorLoginDto {
  @ApiProperty({
    description: 'One-time password from authenticator app',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  otp: string;

  @ApiProperty({
    description: 'Login session ID returned after email/password validation',
  })
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}

export class RecoveryCodeDto {
  @ApiProperty({
    description: 'Recovery code for 2FA',
    example: 'ABC123DEF456',
  })
  @IsString()
  @IsNotEmpty()
  recoveryCode: string;

  @ApiProperty({
    description: 'Login session ID returned after email/password validation',
  })
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}

export class DisableTwoFactorDto {
  @ApiProperty({
    description: 'User password for verification',
  })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    description: 'One-time password from authenticator app',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  otp: string;
}

export class TwoFactorAuthSecretDto {
  @ApiProperty()
  otpAuthUrl: string;

  @ApiProperty()
  secret: string;

  @ApiProperty()
  qrCodeDataUrl: string;
}

export class TwoFactorRecoveryCodesDto {
  @ApiProperty({ type: [String] })
  recoveryCodes: string[];
}
