// two-factor.service.ts

import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';
import * as bcrypt from 'bcrypt';
import { TwoFactorAuth } from './entities/two-factor.entity';
import { User } from '../users/entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(
    @InjectRepository(TwoFactorAuth)
    private twoFactorRepository: Repository<TwoFactorAuth>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private auditService: AuditService,
    private emailService: EmailService,
  ) {}

  async generateSecret(
    userId: string,
  ): Promise<{ secret: string; qrCodeUrl: string }> {
    // Fix: Đảm bảo userId không null hoặc undefined trước khi tiếp tục
    if (!userId) {
      this.logger.error(
        'Attempted to generate 2FA secret with null/undefined userId',
      );
      throw new Error('User ID is required to generate 2FA secret');
    }

    // Find user
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.error(`User not found with ID: ${userId}`);
      throw new NotFoundException('User not found');
    }

    // Generate secret
    const secret = authenticator.generateSecret();
    const appName = 'Secure Auth';
    const otpauth = authenticator.keyuri(user.email, appName, secret);

    // Create or update 2FA record (but don't enable yet)
    let twoFactorAuth = await this.twoFactorRepository.findOne({
      where: { userId },
    });

    if (twoFactorAuth) {
      // Update existing record
      twoFactorAuth.secret = secret;
      twoFactorAuth.isEnabled = false;
    } else {
      // Create new record - đảm bảo userId được đặt
      twoFactorAuth = this.twoFactorRepository.create({
        userId: userId, // Fix: Đặt rõ ràng userId
        secret,
        isEnabled: false,
      });
    }

    this.logger.debug(`Saving 2FA record for user: ${userId}`);
    await this.twoFactorRepository.save(twoFactorAuth);

    // Generate QR code
    const qrCodeUrl = await toDataURL(otpauth);

    // Log the action
    await this.auditService.log({
      action: 'two_factor_setup_initiated',
      userId,
    });

    return { secret, qrCodeUrl };
  }

  async verifyAndEnable(userId: string, token: string): Promise<void> {
    // Find 2FA record
    const twoFactorAuth = await this.twoFactorRepository.findOne({
      where: { userId },
    });
    if (!twoFactorAuth) {
      throw new NotFoundException('Two-factor authentication not set up');
    }

    // Verify token
    const isValid = authenticator.verify({
      token,
      secret: twoFactorAuth.secret,
    });

    if (!isValid) {
      throw new UnauthorizedException('Invalid verification code');
    }

    // Enable 2FA
    twoFactorAuth.isEnabled = true;

    // Generate backup codes if they don't exist
    if (!twoFactorAuth.backupCodes || twoFactorAuth.backupCodes.length === 0) {
      const backupCodes = this.generateBackupCodesInternal();
      twoFactorAuth.backupCodes = backupCodes;
    }

    await this.twoFactorRepository.save(twoFactorAuth);

    // Log the action
    await this.auditService.log({
      action: 'two_factor_enabled',
      userId,
    });

    // Find user to send email
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user) {
      // Send email notification
      await this.emailService.sendTwoFactorBackupCodesEmail(
        user.email,
        user.fullName,
        twoFactorAuth.backupCodes,
      );
    }
  }

  async verify(userId: string, token: string): Promise<boolean> {
    console.log(`Verifying 2FA token for user: ${userId}`);

    // Find 2FA record
    const twoFactorAuth = await this.twoFactorRepository.findOne({
      where: { userId },
    });

    if (!twoFactorAuth) {
      console.log(`No 2FA record found for user: ${userId}`);
      return false; // 2FA record should exist if we're verifying
    }

    if (!twoFactorAuth.isEnabled) {
      console.log(`2FA not enabled for user: ${userId}`);
      return true; // 2FA not enabled, consider verified
    }

    // Verify token with TOTP
    const isValid = authenticator.verify({
      token,
      secret: twoFactorAuth.secret,
    });

    if (isValid) {
      console.log(`2FA TOTP valid for user: ${userId}`);
      // Log successful verification
      await this.auditService.log({
        action: 'two_factor_verified',
        userId,
      });
      return true;
    }

    // Check if it's a backup code
    if (twoFactorAuth.backupCodes && twoFactorAuth.backupCodes.length > 0) {
      console.log(`Checking backup codes for user: ${userId}`);
      const backupCodeIndex = twoFactorAuth.backupCodes.findIndex(
        (code) => code === token,
      );

      if (backupCodeIndex >= 0) {
        console.log(`Valid backup code used for user: ${userId}`);
        // Use up the backup code
        twoFactorAuth.backupCodes.splice(backupCodeIndex, 1);
        await this.twoFactorRepository.save(twoFactorAuth);

        // Log backup code usage
        await this.auditService.log({
          action: 'two_factor_backup_code_used',
          userId,
        });

        return true;
      }
    }

    console.log(`Invalid 2FA verification for user: ${userId}`);
    // Log failed verification
    await this.auditService.log({
      action: 'two_factor_verification_failed',
      userId,
    });

    return false;
  }

  async disable(userId: string, password: string): Promise<void> {
    // Find user
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    // Find 2FA record
    const twoFactorAuth = await this.twoFactorRepository.findOne({
      where: { userId },
    });
    if (!twoFactorAuth || !twoFactorAuth.isEnabled) {
      throw new NotFoundException('Two-factor authentication not enabled');
    }

    // Disable 2FA
    twoFactorAuth.isEnabled = false;
    await this.twoFactorRepository.save(twoFactorAuth);

    // Log the action
    await this.auditService.log({
      action: 'two_factor_disabled',
      userId,
    });

    // Send email notification
    await this.emailService.queueEmail(
      user.email,
      'Two-Factor Authentication Disabled',
      'security-notification',
      {
        name: user.fullName,
        action: 'Two-factor authentication was disabled',
        actionTime: new Date().toISOString(),
      },
    );
  }

  async getBackupCodes(userId: string): Promise<string[]> {
    // Find 2FA record
    const twoFactorAuth = await this.twoFactorRepository.findOne({
      where: { userId },
    });
    if (!twoFactorAuth || !twoFactorAuth.isEnabled) {
      throw new NotFoundException('Two-factor authentication not enabled');
    }

    return twoFactorAuth.backupCodes || [];
  }

  async regenerateBackupCodes(userId: string): Promise<string[]> {
    // Find 2FA record
    const twoFactorAuth = await this.twoFactorRepository.findOne({
      where: { userId },
    });
    if (!twoFactorAuth || !twoFactorAuth.isEnabled) {
      throw new NotFoundException('Two-factor authentication not enabled');
    }

    // Generate new backup codes
    const backupCodes = this.generateBackupCodesInternal();
    twoFactorAuth.backupCodes = backupCodes;
    await this.twoFactorRepository.save(twoFactorAuth);

    // Log the action
    await this.auditService.log({
      action: 'two_factor_backup_codes_regenerated',
      userId,
    });

    // Find user to send email
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user) {
      // Send email with new backup codes
      await this.emailService.sendTwoFactorBackupCodesEmail(
        user.email,
        user.fullName,
        backupCodes,
      );
    }

    return backupCodes;
  }

  private generateBackupCodesInternal(): string[] {
    const backupCodes = [];
    for (let i = 0; i < 10; i++) {
      // Generate a code like: XXXX-XXXX (where X is a number or uppercase letter)
      const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let code = '';
      for (let j = 0; j < 9; j++) {
        if (j === 4) {
          code += '-';
        } else {
          const randomIndex = Math.floor(Math.random() * chars.length);
          code += chars[randomIndex];
        }
      }
      backupCodes.push(code);
    }
    return backupCodes;
  }

  async isTwoFactorEnabled(userId: string): Promise<boolean> {
    const twoFactorAuth = await this.twoFactorRepository.findOne({
      where: { userId },
    });
    return twoFactorAuth?.isEnabled || false;
  }
}
