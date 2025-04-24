import { Injectable, Logger } from '@nestjs/common';
import { IEmailService } from './email.port';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ConsoleEmailService implements IEmailService {
  private readonly logger = new Logger(ConsoleEmailService.name);

  async sendVerificationEmail(
    to: string,
    name: string | null,
    token: string,
  ): Promise<string> {
    this.logger.log(`
      [Email] Verification Email
      To: ${to}
      Name: ${name || 'User'}
      Token: ${token}
    `);
    return uuidv4(); // Trả về một ID duy nhất
  }

  async sendPasswordResetEmail(
    to: string,
    name: string | null,
    token: string,
  ): Promise<string> {
    this.logger.log(`
      [Email] Password Reset Email
      To: ${to}
      Name: ${name || 'User'}
      Token: ${token}
    `);
    return uuidv4();
  }

  async sendWelcomeEmail(to: string, name: string | null): Promise<string> {
    this.logger.log(`
      [Email] Welcome Email
      To: ${to}
      Name: ${name || 'User'}
    `);
    return uuidv4();
  }

  async sendTwoFactorBackupCodesEmail(
    to: string,
    name: string | null,
    codes: string[],
  ): Promise<string> {
    this.logger.log(`
      [Email] 2FA Backup Codes Email
      To: ${to}
      Name: ${name || 'User'}
      Codes: ${codes.join(', ')}
    `);
    return uuidv4();
  }

  async sendLoginNotificationEmail(
    to: string,
    name: string | null,
    device: string,
    location: string,
    time: Date,
  ): Promise<string> {
    this.logger.log(`
      [Email] Login Notification Email
      To: ${to}
      Name: ${name || 'User'}
      Device: ${device}
      Location: ${location}
      Time: ${time.toLocaleString()}
    `);
    return uuidv4();
  }

  async sendLoginAttemptNotificationEmail(
    to: string,
    name: string | null,
    device: string,
    location: string,
    time: Date,
  ): Promise<string> {
    this.logger.log(`
      [Email] Unusual Login Attempt Email
      To: ${to}
      Name: ${name || 'User'}
      Device: ${device}
      Location: ${location}
      Time: ${time.toLocaleString()}
    `);
    return uuidv4();
  }

  async queueEmail(
    to: string,
    subject: string,
    template: string,
    context?: Record<string, any>,
    options?: any
  ): Promise<string> {
    this.logger.log(`
      [Email] Queued Email
      To: ${to}
      Subject: ${subject}
      Template: ${template}
    `);
    return uuidv4();
  }

  async sendBulkEmails(
    recipients: Array<{ email: string; name?: string; context?: Record<string, any> }>,
    subject: string,
    template: string,
    context?: Record<string, any>,
    options?: any
  ): Promise<{ batchId: string; queued: number }> {
    this.logger.log(`
      [Email] Bulk Email
      Recipients: ${recipients.length}
      Subject: ${subject}
      Template: ${template}
    `);
    return { batchId: uuidv4(), queued: recipients.length };
  }

  async getEmailStatus(emailId: string): Promise<any> {
    return Promise.resolve({
      id: emailId,
      status: 'sent', // Mock status for console service
    });
  }

  async resendEmail(emailId: string): Promise<string | null> {
    this.logger.log(`
      [Email] Resend Email
      ID: ${emailId}
    `);
    return uuidv4();
  }
}