// src/organizations/dto/update-member-role.dto.ts
import { IsNotEmpty, IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMemberRoleDto {
  @ApiProperty({
    description: 'New role to assign to the member',
    example: 'admin',
    enum: ['owner', 'admin', 'member'],
  })
  @IsNotEmpty()
  @IsString()
  @IsIn(['owner', 'admin', 'member'])
  role: string;
}
