// src/organizations/dto/invite-member.dto.ts
import { IsNotEmpty, IsString, IsEmail, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InviteMemberDto {
  @ApiProperty({
    description: 'Email address of the user to invite',
    example: 'user@example.com',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Role to assign to the new member',
    example: 'member',
    enum: ['owner', 'admin', 'member'],
  })
  @IsNotEmpty()
  @IsString()
  @IsIn(['owner', 'admin', 'member'])
  role: string;
}
