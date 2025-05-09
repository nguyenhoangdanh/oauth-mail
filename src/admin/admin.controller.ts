// // admin.controller.ts

// import {
//   Controller,
//   Get,
//   Post,
//   Put,
//   Body,
//   Param,
//   Query,
//   UseGuards,
//   NotFoundException,
//   ForbiddenException,
// } from '@nestjs/common';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { AdminGuard } from '../auth/guards/admin.guard';
// import { OrganizationsService } from '../organizations/organizations.service';
// import { AuditService } from '../audit/audit.service';
// import { UserFilterDto } from './dto/user-filter.dto';
// import { OrgFilterDto } from './dto/org-filter.dto';
// import { UpdateUserDto } from '../users/dto/update-user.dto';
// import { GetUser } from '../auth/decorators/get-user.decorator';
// import { User } from '../users/entities/user.entity';
// import { UsersService } from 'src/users/user.service';
// import { AuditLogFilterDto } from './dto/audit-log-filter.dto';

// @Controller('admin')
// @UseGuards(JwtAuthGuard, AdminGuard)
// export class AdminController {
//   constructor(
//     private usersService: UsersService,
//     private organizationsService: OrganizationsService,
//     private auditService: AuditService,
//   ) {}

//   @Get('users')
//   async getUsers(@Query() filter: UserFilterDto) {
//     const [users, total] = await this.usersService.findAll(filter);

//     return {
//       users: users.map((user) => ({
//         id: user.id,
//         email: user.email,
//         fullName: user.fullName,
//         roles: user.roles,
//         emailVerified: user.emailVerified,
//         createdAt: user.createdAt,
//         lastLoginAt: user.lastLoginAt,
//         isActive: user.isActive,
//       })),
//       pagination: {
//         total,
//         page: filter.page || 1,
//         limit: filter.limit || 20,
//         totalPages: Math.ceil(total / (filter.limit || 20)),
//       },
//     };
//   }

//   @Get('users/:id')
//   async getUser(@Param('id') id: string) {
//     const user = await this.usersService.findById(id);

//     if (!user) {
//       throw new NotFoundException('User not found');
//     }

//     // Get user's organizations
//     const organizations = await this.organizationsService.findAll(id);

//     // Get recent audit logs
//     const auditLogs = await this.auditService.findUserActions(id, 20);

//     return {
//       user: {
//         id: user.id,
//         email: user.email,
//         fullName: user.fullName,
//         roles: user.roles,
//         emailVerified: user.emailVerified,
//         createdAt: user.createdAt,
//         lastLoginAt: user.lastLoginAt,
//         isActive: user.isActive,
//       },
//       organizations: organizations.map((org) => ({
//         id: org.id,
//         name: org.name,
//         slug: org.slug,
//       })),
//       auditLogs,
//     };
//   }

//   // admin.controller.ts (continued)

//   @Put('users/:id')
//   async updateUser(
//     @Param('id') id: string,
//     @Body() updateUserDto: UpdateUserDto,
//     @GetUser() admin: User,
//   ) {
//     // Update user
//     const user = await this.usersService.update(id, updateUserDto);

//     // Log this admin action
//     await this.auditService.log({
//       action: 'admin_user_updated',
//       userId: admin.id,
//       metadata: { targetUserId: id, changes: Object.keys(updateUserDto) },
//     });

//     return {
//       success: true,
//       message: 'User updated successfully',
//       user: {
//         id: user.id,
//         email: user.email,
//         fullName: user.fullName,
//         roles: user.roles,
//         emailVerified: user.emailVerified,
//         isActive: user.isActive,
//       },
//     };
//   }

//   @Post('users/:id/suspend')
//   async suspendUser(@Param('id') id: string, @GetUser() admin: User) {
//     // Suspend user (set isActive to false)
//     await this.usersService.setStatus(id, false);

//     // Log this admin action
//     await this.auditService.log({
//       action: 'admin_user_suspended',
//       userId: admin.id,
//       metadata: { targetUserId: id },
//     });

//     return {
//       success: true,
//       message: 'User suspended successfully',
//     };
//   }

//   @Post('users/:id/restore')
//   async restoreUser(@Param('id') id: string, @GetUser() admin: User) {
//     // Restore user (set isActive to true)
//     await this.usersService.setStatus(id, true);

//     // Log this admin action
//     await this.auditService.log({
//       action: 'admin_user_restored',
//       userId: admin.id,
//       metadata: { targetUserId: id },
//     });

//     return {
//       success: true,
//       message: 'User restored successfully',
//     };
//   }

//   @Post('users/:id/make-admin')
//   async makeUserAdmin(@Param('id') id: string, @GetUser() admin: User) {
//     // Add admin role to user
//     await this.usersService.addRole(id, 'admin');

//     // Log this admin action
//     await this.auditService.log({
//       action: 'admin_role_granted',
//       userId: admin.id,
//       metadata: { targetUserId: id, role: 'admin' },
//     });

//     return {
//       success: true,
//       message: 'User was granted admin role',
//     };
//   }

//   @Post('users/:id/remove-admin')
//   async removeUserAdmin(@Param('id') id: string, @GetUser() admin: User) {
//     // Check if this is the last admin
//     const admins = await this.usersService.countUsersByRole('admin');
//     if (admins <= 1) {
//       throw new ForbiddenException('Cannot remove the last admin');
//     }

//     // Remove admin role from user
//     await this.usersService.removeRole(id, 'admin');

//     // Log this admin action
//     await this.auditService.log({
//       action: 'admin_role_revoked',
//       userId: admin.id,
//       metadata: { targetUserId: id, role: 'admin' },
//     });

//     return {
//       success: true,
//       message: 'Admin role was removed from user',
//     };
//   }

//   @Get('organizations')
//   async getOrganizations(@Query() filter: OrgFilterDto) {
//     // Get organizations with pagination and filtering
//     const [organizations, total] =
//       await this.organizationsService.findAllAdmin(filter);

//     return {
//       organizations: organizations.map((org) => ({
//         id: org.id,
//         name: org.name,
//         slug: org.slug,
//         membersCount: org.membersCount,
//         createdAt: org.createdAt,
//         isActive: org.isActive,
//       })),
//       pagination: {
//         total,
//         page: filter.page || 1,
//         limit: filter.limit || 20,
//         totalPages: Math.ceil(total / (filter.limit || 20)),
//       },
//     };
//   }

//   @Get('organizations/:id')
//   async getOrganization(@Param('id') id: string) {
//     // Get organization details
//     const organization = await this.organizationsService.findOneAdmin(id);

//     // Get members
//     const members = await this.organizationsService.getMembersAdmin(id);

//     // Get audit logs for this organization
//     const auditLogs = await this.auditService.findAll({
//       organizationId: id,
//       limit: 20,
//     });

//     return {
//       organization,
//       members,
//       auditLogs: auditLogs[0], // First element contains the logs
//     };
//   }

//   @Post('organizations/:id/suspend')
//   async suspendOrganization(@Param('id') id: string, @GetUser() admin: User) {
//     // Suspend organization
//     await this.organizationsService.setStatus(id, false);

//     // Log this admin action
//     await this.auditService.log({
//       action: 'admin_organization_suspended',
//       userId: admin.id,
//       organizationId: id,
//     });

//     return {
//       success: true,
//       message: 'Organization suspended successfully',
//     };
//   }

//   @Post('organizations/:id/restore')
//   async restoreOrganization(@Param('id') id: string, @GetUser() admin: User) {
//     // Restore organization
//     await this.organizationsService.setStatus(id, true);

//     // Log this admin action
//     await this.auditService.log({
//       action: 'admin_organization_restored',
//       userId: admin.id,
//       organizationId: id,
//     });

//     return {
//       success: true,
//       message: 'Organization restored successfully',
//     };
//   }

//   @Get('audit-logs')
//   async getAuditLogs(@Query() filter: AuditLogFilterDto) {
//     // Get audit logs with pagination and filtering
//     const [logs, total] = await this.auditService.findAll(filter);

//     return {
//       logs,
//       pagination: {
//         total,
//         page: filter.page || 1,
//         limit: filter.limit || 20,
//         totalPages: Math.ceil(total / (filter.limit || 20)),
//       },
//     };
//   }

//   @Get('dashboard/stats')
//   async getDashboardStats() {
//     // Get system statistics for admin dashboard
//     const [
//       totalUsers,
//       activeUsers,
//       newUsersToday,
//       totalOrganizations,
//       totalLogins24h,
//       failedLogins24h,
//     ] = await Promise.all([
//       this.usersService.countUsers({}),
//       this.usersService.countUsers({ isActive: true }),
//       this.usersService.countUsers({
//         createdAt: MoreThan(new Date(Date.now() - 24 * 60 * 60 * 1000)),
//       }),
//       this.organizationsService.countOrganizations({}),
//       this.auditService.countByAction('login', {
//         startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
//       }),
//       this.auditService.countByAction('login_failed', {
//         startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
//       }),
//     ]);

//     return {
//       users: {
//         total: totalUsers,
//         active: activeUsers,
//         newToday: newUsersToday,
//       },
//       organizations: {
//         total: totalOrganizations,
//       },
//       logins: {
//         successful24h: totalLogins24h,
//         failed24h: failedLogins24h,
//       },
//     };
//   }
// }
