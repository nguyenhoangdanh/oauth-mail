import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuditService } from 'src/audit/audit.service';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';

// auth/account-lockout.service.ts
@Injectable()
export class AccountLockoutService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private auditService: AuditService,
  ) {}

  async recordFailedLogin(email: string, ipAddress: string): Promise<boolean> {
    // Find user by email
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      return false; // User not found, don't lock non-existent accounts
    }

    // Get recent failed login attempts
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentFailedAttempts = await this.auditService.findAll({
      userId: user.id,
      action: 'login_failed',
      startDate: oneHourAgo,
    });

    const failedCount = recentFailedAttempts[1]; // Total count

    // Lock account after 5 failed attempts
    if (failedCount >= 5) {
      // Set account as locked
      user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
      await this.userRepository.save(user);

      // Log account lockout
      await this.auditService.log({
        action: 'account_locked',
        userId: user.id,
        ipAddress,
        metadata: { reason: 'too_many_failed_attempts' },
      });

      return true; // Account locked
    }

    return false; // Account not locked yet
  }

  // In account-lockout.service.ts, complete the method
  async isAccountLocked(email: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      return false; // User not found, can't be locked
    }

    // Check if account is locked and the lock period is still active
    return user.lockedUntil && user.lockedUntil > new Date();
  }
}
