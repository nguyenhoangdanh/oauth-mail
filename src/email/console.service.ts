import { Injectable, Logger } from '@nestjs/common';
import { IEmailService } from './email.port';

@Injectable()
export class ConsoleEmailService implements IEmailService {
  private readonly logger = new Logger(ConsoleEmailService.name);

  async sendVerificationEmail(
    to: string,
    name: string | null,
    token: string,
  ): Promise<void> {
    this.logger.log(`
      [Email] Verification Email
      To: ${to}
      Name: ${name || 'User'}
      Token: ${token}
    `);
  }

  async sendPasswordResetEmail(
    to: string,
    name: string | null,
    token: string,
  ): Promise<void> {
    this.logger.log(`
      [Email] Password Reset Email
      To: ${to}
      Name: ${name || 'User'}
      Token: ${token}
    `);
  }

  async sendWelcomeEmail(to: string, name: string | null): Promise<void> {
    this.logger.log(`
      [Email] Welcome Email
      To: ${to}
      Name: ${name || 'User'}
    `);
  }

  async sendTwoFactorBackupCodesEmail(
    to: string,
    name: string | null,
    codes: string[],
  ): Promise<void> {
    this.logger.log(`
      [Email] 2FA Backup Codes Email
      To: ${to}
      Name: ${name || 'User'}
      Codes: ${codes.join(', ')}
    `);
  }

  async sendLoginNotificationEmail(
    to: string,
    name: string | null,
    device: string,
    location: string,
    time: Date,
  ): Promise<void> {
    this.logger.log(`
      [Email] Login Notification Email
      To: ${to}
      Name: ${name || 'User'}
      Device: ${device}
      Location: ${location}
      Time: ${time.toLocaleString()}
    `);
  }

  async sendLoginAttemptNotificationEmail(
    to: string,
    name: string | null,
    device: string,
    location: string,
    time: Date,
  ): Promise<void> {
    this.logger.log(`
      [Email] Unusual Login Attempt Email
      To: ${to}
      Name: ${name || 'User'}
      Device: ${device}
      Location: ${location}
      Time: ${time.toLocaleString()}
    `);
  }
}
