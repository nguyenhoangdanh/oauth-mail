// src/admin/admin.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
  ) {}

  async countUsersByRole(role: string): Promise<number> {
    // This is a simplified implementation
    // In reality, you'd need a more sophisticated query to check roles array
    return this.userRepository.count({
      where: {
        roles: role,
        isActive: true,
      },
    });
  }

  async getSystemStats() {
    const [totalUsers, activeUsers, newUsersToday, totalOrganizations] =
      await Promise.all([
        this.userRepository.count(),
        this.userRepository.count({ where: { isActive: true } }),
        this.userRepository.count({
          where: {
            createdAt: MoreThan(new Date(Date.now() - 24 * 60 * 60 * 1000)),
          },
        }),
        this.organizationRepository.count(),
      ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        newToday: newUsersToday,
      },
      organizations: {
        total: totalOrganizations,
      },
    };
  }
}
