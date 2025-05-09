import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyTwoFactorDto {
  @ApiProperty({
    description: 'The verification code from authenticator app',
    example: '123456',
  })
  @IsNotEmpty()
  @IsString()
  @Length(6, 8)
  token: string;
}
