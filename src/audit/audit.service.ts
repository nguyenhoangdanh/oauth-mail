// audit.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(data: {
    action: string;
    userId?: string;
    organizationId?: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLog> {
    try {
      const log = this.auditLogRepository.create(data);
      return await this.auditLogRepository.save(log);
    } catch (error) {
      this.logger.error(
        `Failed to create audit log: ${error.message}`,
        error.stack,
      );
      // Silent failure - don't break the app flow if audit logging fails
      return null;
    }
  }

  async findAll(filters: {
    userId?: string;
    organizationId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<[AuditLog[], number]> {
    const {
      userId,
      organizationId,
      action,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = filters;

    const queryBuilder =
      this.auditLogRepository.createQueryBuilder('audit_log');

    // Apply filters
    if (userId) {
      queryBuilder.andWhere('audit_log.userId = :userId', { userId });
    }

    if (organizationId) {
      queryBuilder.andWhere('audit_log.organizationId = :organizationId', {
        organizationId,
      });
    }

    if (action) {
      queryBuilder.andWhere('audit_log.action = :action', { action });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere(
        'audit_log.createdAt BETWEEN :startDate AND :endDate',
        {
          startDate,
          endDate,
        },
      );
    } else if (startDate) {
      queryBuilder.andWhere('audit_log.createdAt >= :startDate', { startDate });
    } else if (endDate) {
      queryBuilder.andWhere('audit_log.createdAt <= :endDate', { endDate });
    }

    // Pagination
    queryBuilder
      .orderBy('audit_log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findUserActions(
    userId: string,
    limit: number = 10,
  ): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findRecentActivityByType(
    action: string,
    limit: number = 10,
  ): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { action },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findRecentSecurityEvents(
    userId: string,
    limit: number = 10,
  ): Promise<AuditLog[]> {
    const securityActions = [
      'login',
      'login_failed',
      'password_changed',
      'password_reset',
      'two_factor_enabled',
      'two_factor_disabled',
      'two_factor_verified',
      'two_factor_verification_failed',
      'session_created',
      'session_revoked',
      'all_sessions_revoked',
    ];

    return this.auditLogRepository.find({
      where: {
        userId,
        action: In(securityActions),
      },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findLoginHistory(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<AuditLog[]> {
    const whereCondition: any = {
      userId,
      action: In([
        'login',
        'login_failed',
        'login_magic_link',
        'login_oauth_google',
        'login_oauth_github',
        'login_oauth_facebook',
      ]),
    };

    if (startDate && endDate) {
      whereCondition.createdAt = Between(startDate, endDate);
    }

    return this.auditLogRepository.find({
      where: whereCondition,
      order: { createdAt: 'DESC' },
    });
  }
}
