// src/audit/audit.controller.ts
import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AuditService } from './audit.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('audit')
@Controller('audit')
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('my-activity')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get current user's activity logs" })
  async getMyActivity(
    @GetUser() user: User,
    @Query('limit') limit: number = 10,
  ) {
    const logs = await this.auditService.findUserActions(user.id, limit);
    return { logs };
  }

  @Get('my-security')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get current user's security events" })
  async getMySecurityEvents(
    @GetUser() user: User,
    @Query('limit') limit: number = 10,
  ) {
    const logs = await this.auditService.findRecentSecurityEvents(
      user.id,
      limit,
    );
    return { logs };
  }

  @Get('my-logins')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get current user's login history" })
  async getMyLoginHistory(
    @GetUser() user: User,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const logs = await this.auditService.findLoginHistory(user.id, start, end);
    return { logs };
  }

  // Admin only endpoints
  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Get all audit logs (admin only)' })
  async getAllLogs(
    @Query('userId') userId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('action') action?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const [logs, total] = await this.auditService.findAll({
      userId,
      organizationId,
      action,
      startDate: start,
      endDate: end,
      page,
      limit,
    });

    return {
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Get audit logs for a specific user (admin only)' })
  async getUserLogs(
    @Param('userId') userId: string,
    @Query('limit') limit: number = 20,
  ) {
    const logs = await this.auditService.findUserActions(userId, limit);
    return { logs };
  }

  @Get('action/:action')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({
    summary: 'Get audit logs for a specific action type (admin only)',
  })
  async getActionLogs(
    @Param('action') action: string,
    @Query('limit') limit: number = 20,
  ) {
    const logs = await this.auditService.findRecentActivityByType(
      action,
      limit,
    );
    return { logs };
  }
}
