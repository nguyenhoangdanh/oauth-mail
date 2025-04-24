// src/email/email.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { IEmailService } from './email.port';
import { EmailLog } from './entities/email-log.entity';
import { EmailTemplate } from './entities/email-template.entity';
import { EmailJob, BulkEmailJob } from './interfaces/email-job.interface';
import { EmailTrackingHelper } from './email.tracking.helper';
import Queue from 'bull';

@Injectable()
export class EmailService implements IEmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly appName: string;
  private readonly appUrl: string;
  private readonly webhookHandlers: Map<string, Array<(data: any) => void>> = new Map();

  constructor(
    @InjectRepository(EmailLog)
    private readonly emailLogRepository: Repository<EmailLog>,
    @InjectRepository(EmailTemplate)
    private readonly templateRepository: Repository<EmailTemplate>,
    @InjectQueue('email-queue')
    private readonly emailQueue: Queue<EmailJob | BulkEmailJob>,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly emailTrackingHelper: EmailTrackingHelper,
  ) {
    this.appName = this.configService.get<string>('APP_NAME', 'SecureMail');
    this.appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');

    // Initialize webhook event types
    this.registerWebhookEventType('sent');
    this.registerWebhookEventType('delivered');
    this.registerWebhookEventType('opened');
    this.registerWebhookEventType('clicked');
    this.registerWebhookEventType('bounced');
    this.registerWebhookEventType('complained');
    this.registerWebhookEventType('failed');
  }

  /**
   * Send a verification email
   */
  async sendVerificationEmail(
    to: string,
    name: string | null,
    token: string,
  ): Promise<string> {
    const verificationUrl = `${this.appUrl}/auth/verify-email/${token}`;
    const context = {
      name: name || 'User',
      token,
      verificationUrl,
    };

    return this.queueEmail(
      to,
      `Verify your email for ${this.appName}`,
      'verification',
      context,
    );
  }

  /**
   * Send a password reset email
   */
  async sendPasswordResetEmail(
    to: string,
    name: string | null,
    token: string,
  ): Promise<string> {
    const resetUrl = `${this.appUrl}/auth/reset-password/${token}`;
    const context = {
      name: name || 'User',
      token,
      resetUrl,
    };

    return this.queueEmail(
      to,
      `Reset your password for ${this.appName}`,
      'password-reset',
      context,
    );
  }

  /**
   * Send a welcome email
   */
  async sendWelcomeEmail(to: string, name: string | null): Promise<string> {
    const loginUrl = `${this.appUrl}/auth/login`;
    const context = {
      name: name || 'User',
      loginUrl,
    };

    return this.queueEmail(
      to,
      `Welcome to ${this.appName}!`,
      'welcome',
      context,
    );
  }

  /**
   * Send 2FA backup codes email
   */
  async sendTwoFactorBackupCodesEmail(
    to: string,
    name: string | null,
    codes: string[],
  ): Promise<string> {
    const context = {
      name: name || 'User',
      codes,
    };

    return this.queueEmail(
      to,
      `Your 2FA backup codes for ${this.appName}`,
      '2fa-backup-codes',
      context,
    );
  }

  /**
   * Send login notification email
   */
  async sendLoginNotificationEmail(
    to: string,
    name: string | null,
    device: string,
    location: string,
    time: Date,
  ): Promise<string> {
    const accountSettingsUrl = `${this.appUrl}/account/security`;
    const context = {
      name: name || 'User',
      device,
      location,
      time: time.toLocaleString(),
      accountSettingsUrl,
    };

    return this.queueEmail(
      to,
      `New login to your ${this.appName} account`,
      'login-notification',
      context,
    );
  }

  /**
   * Send login attempt notification email
   */
  async sendLoginAttemptNotificationEmail(
    to: string,
    name: string | null,
    device: string,
    location: string,
    time: Date,
  ): Promise<string> {
    const resetPasswordUrl = `${this.appUrl}/auth/forgot-password`;
    const context = {
      name: name || 'User',
      device,
      location,
      time: time.toLocaleString(),
      resetPasswordUrl,
    };

    return this.queueEmail(
      to,
      `Unusual login attempt on your ${this.appName} account`,
      'login-attempt',
      context,
    );
  }

  /**
   * Queue a single email to be sent
   */
  async queueEmail(
    to: string,
    subject: string,
    template: string,
    context: Record<string, any> = {},
    options: {
      priority?: number;
      delay?: number;
      campaignId?: string;
    } = {},
  ): Promise<string> {
    if (!to || typeof to !== 'string' || to.trim() === '') {
      throw new Error('Email recipient is required');
    }

    // Check if template exists
    const templateExists = await this.templateRepository.findOne({
      where: { name: template, isActive: true },
    });

    if (!templateExists) {
      throw new Error(`Email template "${template}" not found or inactive`);
    }

    // Generate unique ID for tracking
    const emailId = uuidv4();

    // Create email log entry
    await this.emailLogRepository.save({
      emailId,
      to: to.trim(),
      name: context.name,
      subject,
      template,
      context: {
        ...context,
        emailId,
      },
      status: 'pending',
    });

    // Add to queue with options
    const jobOptions: any = {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    };

    // Add priority if specified
    if (options.priority) {
      jobOptions.priority = options.priority;
    }

    // Add delay if specified
    if (options.delay) {
      jobOptions.delay = options.delay;
    }

    // Add to queue
    await this.emailQueue.add(
      'send-email',
      {
        id: emailId,
        to: to.trim(),
        subject,
        template,
        context: {
          ...context,
          emailId,
          campaignId: options.campaignId,
        },
        campaignId: options.campaignId,
      },
      jobOptions,
    );

    this.logger.log(`Email queued with ID: ${emailId}`);
    return emailId;
  }

  /**
   * Send emails in bulk
   */
  async sendBulkEmails(
    recipients: Array<{ email: string; name?: string; context?: Record<string, any> }>,
    subject: string,
    template: string,
    context: Record<string, any> = {},
    options: {
      campaignId?: string;
      batchSize?: number;
    } = {},
  ): Promise<{ batchId: string; queued: number }> {
    // Validate inputs
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      throw new Error('Recipients list is required and must not be empty');
    }

    // Check if template exists
    const templateExists = await this.templateRepository.findOne({
      where: { name: template, isActive: true },
    });

    if (!templateExists) {
      throw new Error(`Email template "${template}" not found or inactive`);
    }

    // Generate batch ID
    const batchId = options.campaignId || uuidv4();
    const batchSize = options.batchSize || 100;

    // Split recipients into batches
    const batches = [];
    for (let i = 0; i < recipients.length; i += batchSize) {
      batches.push(recipients.slice(i, i + batchSize));
    }

    // Queue each batch
    let queued = 0;
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      await this.emailQueue.add(
        'send-bulk',
        {
          batchId,
          recipients: batch,
          template,
          subject,
          context,
          campaignId: options.campaignId,
        },
        {
          attempts: 2,
          backoff: {
            type: 'fixed',
            delay: 10000,
          },
          removeOnComplete: true,
        },
      );
      queued += batch.length;
    }

    this.logger.log(`Bulk email job queued with batch ID ${batchId} for ${queued} recipients`);
    return { batchId, queued };
  }

  /**
   * Get email status
   */
  async getEmailStatus(emailId: string): Promise<EmailLog | null> {
    return this.emailLogRepository.findOne({ where: { emailId } });
  }

  /**
   * Track campaign open
   */
  async trackCampaignOpen(campaignId: string, data: Record<string, any> = {}): Promise<void> {
    // Emit campaign open event
    this.eventEmitter.emit('campaign.opened', {
      id: uuidv4(),
      event: 'opened',
      campaignId,
      timestamp: new Date(),
      metadata: data,
    });
  }

  /**
   * Register webhook handler
   */
  registerWebhook(event: string, handler: (data: any) => void): void {
    if (!this.webhookHandlers.has(event)) {
      this.registerWebhookEventType(event);
    }

    const handlers = this.webhookHandlers.get(event) || [];
    handlers.push(handler);
    this.webhookHandlers.set(event, handlers);
    this.logger.log(`Registered webhook handler for event: ${event}`);
  }

  /**
   * Register webhook event type
   */
  registerWebhookEventType(event: string): void {
    if (!this.webhookHandlers.has(event)) {
      this.webhookHandlers.set(event, []);
    }
  }

  /**
   * Trigger webhook
   */
  triggerWebhook(event: string, data: any): void {
    const handlers = this.webhookHandlers.get(event) || [];
    handlers.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        this.logger.error(
          `Error in webhook handler for ${event}: ${error.message}`,
          error.stack,
        );
      }
    });

    // Also emit as a NestJS event
    this.eventEmitter.emit(`email.${event}`, data);
  }
  
  /**
   * Create or update a template
   */
  async saveTemplate(
    name: string, 
    content: string, 
    data: { 
      subject?: string; 
      description?: string; 
      isActive?: boolean 
    } = {}
  ): Promise<EmailTemplate> {
    // Find existing template
    let template = await this.templateRepository.findOne({ where: { name } });
    
    if (template) {
      // Update existing template
      template.content = content;
      if (data.subject !== undefined) template.subject = data.subject;
      if (data.description !== undefined) template.description = data.description;
      if (data.isActive !== undefined) template.isActive = data.isActive;
    } else {
      // Create new template
      template = this.templateRepository.create({
        name,
        content,
        subject: data.subject,
        description: data.description,
        isActive: data.isActive !== undefined ? data.isActive : true,
      });
    }
    
    return this.templateRepository.save(template);
  }
  
  /**
   * Get email logs
   */
  async getEmailLogs(
    filters: Record<string, any> = {}, 
    page = 1, 
    limit = 20
  ): Promise<{ data: EmailLog[]; total: number; page: number; pages: number }> {
    const [data, total] = await this.emailLogRepository.findAndCount({
      where: filters,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    
    return {
      data,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }
  
  /**
   * Resend a failed email
   */
  async resendEmail(emailId: string): Promise<string | null> {
    const emailLog = await this.emailLogRepository.findOne({ where: { emailId } });
    
    if (!emailLog) {
      throw new Error('Email not found');
    }
    
    if (!['failed', 'bounced'].includes(emailLog.status)) {
      throw new Error('Only failed or bounced emails can be resent');
    }
    
    // Create a new email with the same details
    const newEmailId = await this.queueEmail(
      emailLog.to,
      emailLog.subject,
      emailLog.template,
      emailLog.context,
    );
    
    // Update the original email log with reference to the resend
    emailLog.resendId = newEmailId;
    await this.emailLogRepository.save(emailLog);
    
    return newEmailId;
  }
}