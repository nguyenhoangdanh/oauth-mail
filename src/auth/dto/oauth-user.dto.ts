// src/auth/dto/oauth-user.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsObject,
  IsOptional,
} from 'class-validator';

export class OAuthUserDto {
  @ApiProperty({
    description: 'OAuth provider name',
    example: 'google',
  })
  @IsString()
  @IsNotEmpty()
  provider: string;

  @ApiProperty({
    description: 'Provider-specific user ID',
    example: '123456789',
  })
  @IsString()
  @IsNotEmpty()
  providerId: string;

  @ApiProperty({
    description: 'User email from OAuth provider',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'User full name from OAuth provider',
    example: 'John Doe',
  })
  @IsString()
  fullName: string;

  @ApiProperty({
    description: 'User avatar URL from OAuth provider',
    example: 'https://example.com/avatar.jpg',
  })
  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @ApiProperty({
    description: 'OAuth access token',
    example: 'ya29.a0AfB_byC3...',
  })
  @IsString()
  @IsNotEmpty()
  accessToken: string;

  @ApiProperty({
    description: 'OAuth refresh token',
    example: '1//042gQL...',
  })
  @IsString()
  @IsOptional()
  refreshToken?: string;

  @ApiProperty({
    description: 'Complete profile data from OAuth provider',
    example: {
      id: '123456789',
      displayName: 'John Doe',
      emails: [{ value: 'user@example.com' }],
      // Other provider-specific fields
    },
  })
  @IsObject()
  @IsOptional()
  profile?: any;
}
