// organizations.service.ts

import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { OrganizationMembership } from './entities/organization-membership.entity';
import { OrganizationInvitation } from './entities/organization-invitation.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { v4 as uuidv4 } from 'uuid';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(OrganizationMembership)
    private membershipRepository: Repository<OrganizationMembership>,
    @InjectRepository(OrganizationInvitation)
    private invitationRepository: Repository<OrganizationInvitation>,
    private auditService: AuditService,
    private emailService: EmailService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(
    createOrgDto: CreateOrganizationDto,
    userId: string,
  ): Promise<Organization> {
    // Create the organization
    const organization = this.organizationRepository.create({
      name: createOrgDto.name,
      slug: this.generateSlug(createOrgDto.name),
      logoUrl: createOrgDto.logoUrl,
    });

    const savedOrg = await this.organizationRepository.save(organization);

    // Add the creator as an owner
    const membership = this.membershipRepository.create({
      organizationId: savedOrg.id,
      userId,
      role: 'owner',
    });

    await this.membershipRepository.save(membership);

    // Log action
    await this.auditService.log({
      action: 'organization_created',
      userId,
      organizationId: savedOrg.id,
      metadata: { name: savedOrg.name },
    });

    // Emit event for webhooks
    this.eventEmitter.emit('organization.created', {
      organizationId: savedOrg.id,
      name: savedOrg.name,
      createdBy: userId,
      timestamp: new Date(),
    });

    return savedOrg;
  }

  async findAll(userId: string): Promise<Organization[]> {
    // Find all memberships for this user
    const memberships = await this.membershipRepository.find({
      where: { userId, isActive: true },
      relations: ['organization'],
    });

    // Extract organizations
    return memberships.map((membership) => membership.organization);
  }

  async findOne(id: string, userId: string): Promise<Organization> {
    // Check if user is a member
    const membership = await this.membershipRepository.findOne({
      where: { organizationId: id, userId, isActive: true },
    });

    if (!membership) {
      throw new NotFoundException(
        'Organization not found or you do not have access',
      );
    }

    // Return organization
    const organization = await this.organizationRepository.findOne({
      where: { id },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async update(
    id: string,
    updateOrgDto: UpdateOrganizationDto,
    userId: string,
  ): Promise<Organization> {
    // Check if user is an owner or admin
    const hasPermission = await this.checkUserPermission(id, userId, [
      'owner',
      'admin',
    ]);
    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have permission to update this organization',
      );
    }

    // Update organization
    await this.organizationRepository.update(id, updateOrgDto);

    // Get updated organization
    const organization = await this.organizationRepository.findOne({
      where: { id },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Log action
    await this.auditService.log({
      action: 'organization_updated',
      userId,
      organizationId: id,
      metadata: { changes: updateOrgDto },
    });

    // Emit event for webhooks
    this.eventEmitter.emit('organization.updated', {
      organizationId: id,
      updatedBy: userId,
      changes: updateOrgDto,
      timestamp: new Date(),
    });

    return organization;
  }

  async inviteMember(
    orgId: string,
    inviteDto: InviteMemberDto,
    invitedById: string,
  ): Promise<OrganizationInvitation> {
    // Check if user is an owner or admin
    const hasPermission = await this.checkUserPermission(orgId, invitedById, [
      'owner',
      'admin',
    ]);
    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have permission to invite members',
      );
    }

    // Check if user is already a member
    const existingMembership = await this.membershipRepository.findOne({
      where: {
        organizationId: orgId,
        // We don't have a direct way to check by email, so this would need to be joined with users table
        // This is a simplification - in reality, we would need to find the user by email first
      },
    });

    if (existingMembership) {
      throw new ConflictException(
        'User is already a member of this organization',
      );
    }

    // Check if there's already a pending invitation
    const existingInvitation = await this.invitationRepository.findOne({
      where: {
        organizationId: orgId,
        email: inviteDto.email,
        used: false,
      },
    });

    if (existingInvitation) {
      throw new ConflictException(
        'There is already a pending invitation for this email',
      );
    }

    // Create invitation
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    const invitation = this.invitationRepository.create({
      organizationId: orgId,
      email: inviteDto.email,
      role: inviteDto.role,
      token: uuidv4(),
      expiresAt,
      invitedById,
    });

    const savedInvitation = await this.invitationRepository.save(invitation);

    // Get organization details
    const organization = await this.organizationRepository.findOne({
      where: { id: orgId },
    });

    // Send invitation email
    await this.emailService.queueEmail(
      inviteDto.email,
      `Invitation to join ${organization.name}`,
      'organization-invitation',
      {
        invitationToken: savedInvitation.token,
        organizationName: organization.name,
        invitationLink: `https://your-app.com/invitations/${savedInvitation.token}`,
        role: inviteDto.role,
        expiresAt: expiresAt.toISOString(),
      },
    );

    // Log action
    await this.auditService.log({
      action: 'organization_invitation_sent',
      userId: invitedById,
      organizationId: orgId,
      metadata: { email: inviteDto.email, role: inviteDto.role },
    });

    return savedInvitation;
  }

  async getMembers(
    orgId: string,
    userId: string,
  ): Promise<OrganizationMembership[]> {
    // Check if user is a member
    const membership = await this.membershipRepository.findOne({
      where: { organizationId: orgId, userId, isActive: true },
    });

    if (!membership) {
      throw new NotFoundException(
        'Organization not found or you do not have access',
      );
    }

    // Get all members
    return this.membershipRepository.find({
      where: { organizationId: orgId, isActive: true },
      relations: ['user'],
    });
  }

  async updateMemberRole(
    orgId: string,
    memberId: string,
    role: string,
    userId: string,
  ): Promise<OrganizationMembership> {
    // Check if user is an owner
    const hasPermission = await this.checkUserPermission(orgId, userId, [
      'owner',
    ]);
    if (!hasPermission) {
      throw new ForbiddenException('Only owners can change member roles');
    }

    // Find membership
    const membership = await this.membershipRepository.findOne({
      where: { id: memberId, organizationId: orgId },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    // Update role
    membership.role = role;
    const updatedMembership = await this.membershipRepository.save(membership);

    // Log action
    await this.auditService.log({
      action: 'organization_member_role_updated',
      userId,
      organizationId: orgId,
      metadata: { memberId, newRole: role },
    });

    // Emit event for webhooks
    this.eventEmitter.emit('organization.member_role_changed', {
      organizationId: orgId,
      memberId: membership.userId,
      role,
      changedBy: userId,
      timestamp: new Date(),
    });

    return updatedMembership;
  }

  async removeMember(
    orgId: string,
    memberId: string,
    userId: string,
  ): Promise<void> {
    // Check if user is an owner or admin
    const hasPermission = await this.checkUserPermission(orgId, userId, [
      'owner',
      'admin',
    ]);
    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have permission to remove members',
      );
    }

    // Find membership
    const membership = await this.membershipRepository.findOne({
      where: { id: memberId, organizationId: orgId },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    // Cannot remove the last owner
    if (membership.role === 'owner') {
      const owners = await this.membershipRepository.count({
        where: { organizationId: orgId, role: 'owner', isActive: true },
      });

      if (owners <= 1) {
        throw new ForbiddenException('Cannot remove the last owner');
      }
    }

    // Soft delete by setting isActive to false
    membership.isActive = false;
    await this.membershipRepository.save(membership);

    // Log action
    await this.auditService.log({
      action: 'organization_member_removed',
      userId,
      organizationId: orgId,
      metadata: { memberId, memberUserId: membership.userId },
    });

    // Emit event for webhooks
    this.eventEmitter.emit('organization.member_removed', {
      organizationId: orgId,
      memberId: membership.userId,
      removedBy: userId,
      timestamp: new Date(),
    });
  }

  async getInvitations(email: string): Promise<OrganizationInvitation[]> {
    // Get all active invitations for this email
    return this.invitationRepository.find({
      where: {
        email,
        used: false,
        expiresAt: MoreThan(new Date()),
      },
      relations: ['organization'],
    });
  }

  async acceptInvitation(
    invitationId: string,
    userId: string,
  ): Promise<OrganizationMembership> {
    // Find invitation
    const invitation = await this.invitationRepository.findOne({
      where: {
        id: invitationId,
        used: false,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found or has expired');
    }

    // Create membership
    const membership = this.membershipRepository.create({
      organizationId: invitation.organizationId,
      userId,
      role: invitation.role,
    });

    const savedMembership = await this.membershipRepository.save(membership);

    // Mark invitation as used
    invitation.used = true;
    await this.invitationRepository.save(invitation);

    // Log action
    await this.auditService.log({
      action: 'organization_invitation_accepted',
      userId,
      organizationId: invitation.organizationId,
      metadata: { invitationId },
    });

    // Emit event for webhooks
    this.eventEmitter.emit('organization.member_added', {
      organizationId: invitation.organizationId,
      memberId: userId,
      role: invitation.role,
      timestamp: new Date(),
    });

    return savedMembership;
  }

  async declineInvitation(invitationId: string, userId: string): Promise<void> {
    // Find invitation
    const invitation = await this.invitationRepository.findOne({
      where: {
        id: invitationId,
        used: false,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found or has expired');
    }

    // Mark invitation as used (declined)
    invitation.used = true;
    await this.invitationRepository.save(invitation);

    // Log action
    await this.auditService.log({
      action: 'organization_invitation_declined',
      userId,
      organizationId: invitation.organizationId,
      metadata: { invitationId },
    });
  }

  async checkUserPermission(
    orgId: string,
    userId: string,
    requiredRoles: string[],
  ): Promise<boolean> {
    const membership = await this.membershipRepository.findOne({
      where: { organizationId: orgId, userId, isActive: true },
    });

    if (!membership) {
      return false;
    }

    return requiredRoles.includes(membership.role);
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}
