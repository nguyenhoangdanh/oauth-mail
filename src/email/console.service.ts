import { Injectable, Logger } from '@nestjs/common';
import { IEmailService, LoginInfo } from './email.port';
import { v4 as uuidv4 } from 'uuid';
import { EmailTemplate } from './entities/email-template.entity';
import { EmailStatus } from './entities/email-log.entity';

@Injectable()
export class ConsoleEmailService implements IEmailService {
  private readonly logger = new Logger(ConsoleEmailService.name);
  private readonly webhookHandlers: Map<string, Array<(data: any) => void>> =
    new Map();
  private readonly emailLogs: Map<string, any> = new Map();
  private readonly templates: Map<string, EmailTemplate> = new Map();
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

  async sendLoginNotification(
    email: string,
    name: string,
    loginInfo: LoginInfo,
  ): Promise<void> {
    this.logger.log(`
      [Email] Login Notification
      To: ${email}
      Name: ${name || 'User'}
      Device: ${loginInfo.device || 'Unknown'}
      Location: ${loginInfo.location || 'Unknown'}
      Time: ${loginInfo.time?.toLocaleString() || new Date().toLocaleString()}
    `);
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
    // context?: Record<string, any>,
    // options?: any,
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
    recipients: Array<{
      email: string;
      name?: string;
      context?: Record<string, any>;
    }>,
    subject: string,
    template: string,
    // context?: Record<string, any>,
    // options?: any,
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
      status: EmailStatus.SENT,
    });
  }

  async resendEmail(emailId: string): Promise<string | null> {
    this.logger.log(`
      [Email] Resend Email
      ID: ${emailId}
    `);
    return uuidv4();
  }

  /**
   * Register webhook handler for specific event
   * @param event Event name to listen for
   * @param handler Function to call when event occurs
   */
  registerWebhook(event: string, handler: (data: any) => void): void {
    if (!event || typeof handler !== 'function') {
      this.logger.warn('Invalid webhook registration attempt');
      return;
    }

    if (!this.webhookHandlers.has(event)) {
      this.webhookHandlers.set(event, []);
    }

    const handlers = this.webhookHandlers.get(event) || [];
    handlers.push(handler);
    this.webhookHandlers.set(event, handlers);
    this.logger.log(`Registered webhook handler for event: ${event}`);
  }

  // Implémentation des méthodes manquantes
  async getTemplates(filters?: {
    isActive?: boolean;
    category?: string;
    search?: string;
  }): Promise<EmailTemplate[]> {
    // Simuler la récupération des templates
    this.logger.log(
      `[Console] Get templates with filters: ${JSON.stringify(filters || {})}`,
    );
    return Array.from(this.templates.values());
  }

  async saveTemplate(
    name: string,
    content: string,
    data?: {
      subject?: string;
      description?: string;
      isActive?: boolean;
      version?: number;
      lastEditor?: string;
      previewText?: string;
      category?: string;
    },
  ): Promise<EmailTemplate> {
    this.logger.log(`[Console] Save template "${name}"`);

    const template: EmailTemplate = {
      id: uuidv4(),
      name,
      content,
      subject: data?.subject,
      description: data?.description,
      isActive: data?.isActive !== undefined ? data?.isActive : true,
      version: data?.version || 1,
      lastEditor: data?.lastEditor,
      previewText: data?.previewText,
      category: data?.category,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.templates.set(name, template);
    return template;
  }

  // Méthode utilitaire pour enregistrer un email
  private logEmail(
    id: string,
    to: string,
    subject: string,
    template: string,
    extraData: Record<string, any> = {},
  ): void {
    this.emailLogs.set(id, {
      id,
      to,
      subject,
      template,
      status: 'sent',
      sentAt: new Date(),
      ...extraData,
    });
  }
}
