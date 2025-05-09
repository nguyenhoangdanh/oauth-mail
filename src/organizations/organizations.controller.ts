// organizations.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../users/entities/user.entity';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@ApiTags('organizations')
@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @ApiOperation({ summary: 'Create a new organization' })
  @ApiBearerAuth()
  @Post()
  async createOrganization(
    @Body() createOrgDto: CreateOrganizationDto,
    @GetUser() user: User,
  ) {
    return this.organizationsService.create(createOrgDto, user.id);
  }

  @ApiOperation({ summary: 'Get all organizations for current user' })
  @ApiBearerAuth()
  @Get()
  async getUserOrganizations(@GetUser() user: User) {
    return this.organizationsService.findAll(user.id);
  }

  @ApiOperation({ summary: 'Get organization by ID' })
  @ApiBearerAuth()
  @Get(':id')
  async getOrganization(@Param('id') id: string, @GetUser() user: User) {
    return this.organizationsService.findOne(id, user.id);
  }

  @ApiOperation({ summary: 'Update organization' })
  @ApiBearerAuth()
  @Put(':id')
  async updateOrganization(
    @Param('id') id: string,
    @Body() updateOrgDto: UpdateOrganizationDto,
    @GetUser() user: User,
  ) {
    return this.organizationsService.update(id, updateOrgDto, user.id);
  }

  @ApiOperation({ summary: 'Invite a member to organization' })
  @ApiBearerAuth()
  @Post(':id/members')
  async inviteMember(
    @Param('id') id: string,
    @Body() inviteDto: InviteMemberDto,
    @GetUser() user: User,
  ) {
    return this.organizationsService.inviteMember(id, inviteDto, user.id);
  }

  @ApiOperation({ summary: 'Get organization members' })
  @ApiBearerAuth()
  @Get(':id/members')
  async getMembers(@Param('id') id: string, @GetUser() user: User) {
    return this.organizationsService.getMembers(id, user.id);
  }

  @ApiOperation({ summary: 'Update member role' })
  @ApiBearerAuth()
  @Put(':id/members/:memberId')
  async updateMemberRole(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() updateRoleDto: UpdateMemberRoleDto,
    @GetUser() user: User,
  ) {
    return this.organizationsService.updateMemberRole(
      id,
      memberId,
      updateRoleDto.role,
      user.id,
    );
  }

  @ApiOperation({ summary: 'Remove member from organization' })
  @ApiBearerAuth()
  @Delete(':id/members/:memberId')
  async removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @GetUser() user: User,
  ) {
    return this.organizationsService.removeMember(id, memberId, user.id);
  }

  @ApiOperation({ summary: 'Get pending invitations for current user' })
  @ApiBearerAuth()
  @Get('invitations')
  async getUserInvitations(@GetUser() user: User) {
    return this.organizationsService.getInvitations(user.email);
  }

  @ApiOperation({ summary: 'Accept organization invitation' })
  @ApiBearerAuth()
  @Post('invitations/:id/accept')
  async acceptInvitation(@Param('id') id: string, @GetUser() user: User) {
    return this.organizationsService.acceptInvitation(id, user.id);
  }

  @ApiOperation({ summary: 'Decline organization invitation' })
  @ApiBearerAuth()
  @Post('invitations/:id/decline')
  async declineInvitation(@Param('id') id: string, @GetUser() user: User) {
    return this.organizationsService.declineInvitation(id, user.id);
  }
}
