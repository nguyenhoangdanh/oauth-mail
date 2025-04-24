// src/email/email.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like } from 'typeorm';
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
import * as Handlebars from 'handlebars';

// Define common options interface for consistency
interface EmailOptions {
  priority?: number;
  delay?: number;
  campaignId?: string;
  tags?: string[];
  userId?: string;
  isTest?: boolean;
}

// Extend for bulk emails
interface BulkEmailOptions extends Omit<EmailOptions, 'delay' | 'priority'> {
  batchSize?: number;
}

@Injectable()
export class EmailService implements IEmailService, OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private readonly appName: string;
  private readonly appUrl: string;
  private readonly webhookHandlers: Map<string, Array<(data: any) => void>> = new Map();
  private readonly cachedTemplates: Map<string, Handlebars.TemplateDelegate<any>> = new Map();

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
   * Initialize service - load templates 
   */
  async onModuleInit() {
    try {
      await this.loadTemplates();
      this.logger.log('Email service initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize email service: ${error.message}`, error.stack);
    }
  }

  /**
   * Load templates into memory cache
   */
  private async loadTemplates(): Promise<void> {
    try {
      const templates = await this.templateRepository.find({ 
        where: { isActive: true } 
      });
      
      for (const template of templates) {
        try {
          this.cachedTemplates.set(
            template.name, 
            Handlebars.compile(template.content)
          );
          this.logger.log(`Loaded template: ${template.name}`);
        } catch (error) {
          this.logger.error(`Failed to compile template ${template.name}: ${error.message}`);
        }
      }
      
      this.logger.log(`Loaded ${this.cachedTemplates.size} email templates`);
    } catch (error) {
      this.logger.error(`Failed to load email templates: ${error.message}`, error.stack);
    }
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
    options: EmailOptions = {},
  ): Promise<string> {
    if (!to || typeof to !== 'string' || to.trim() === '') {
      throw new Error('Email recipient is required');
    }

    // Check if template exists in cache or database
    let templateExists = this.cachedTemplates.has(template);
    
    if (!templateExists) {
      // Try to fetch from database if not in cache
      const templateRecord = await this.templateRepository.findOne({
        where: { name: template, isActive: true },
      });
      
      templateExists = templateRecord !== null;
      
      if (!templateExists) {
        throw new Error(`Email template "${template}" not found or inactive`);
      }
      
      // Load template into cache for future use
      await this.reloadTemplate(template);
    }

    // Generate unique ID for tracking
    const emailId = uuidv4();

    // Create enhanced context with standard variables
    const enhancedContext = {
      ...context,
      emailId,
      appName: this.appName,
      appUrl: this.appUrl,
      currentYear: new Date().getFullYear(),
    };

    // Create email log entry
    await this.emailLogRepository.save({
      emailId,
      to: to.trim(),
      name: context.name,
      subject,
      template,
      context: enhancedContext,
      status: 'pending',
      campaignId: options.campaignId,
      tags: options.tags,
      userId: options.userId,
      isTest: options.isTest || false
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
    await this.emailQueue.add({
      name: 'send-email',
      id: emailId,
      to: to.trim(),
      subject,
      template,
      context: enhancedContext,
      campaignId: options.campaignId,
    }, jobOptions);

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
    options: BulkEmailOptions = {},
  ): Promise<{ batchId: string; queued: number }> {
    // Validate inputs
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      throw new Error('Recipients list is required and must not be empty');
    }

    // Check if template exists
    const templateRecord = await this.templateRepository.findOne({
      where: { name: template, isActive: true },
    });

    if (!templateRecord) {
      throw new Error(`Email template "${template}" not found or inactive`);
    }

    // Generate batch ID
    const batchId = options.campaignId || uuidv4();
    const batchSize = options.batchSize || 100;

    // Create enhanced context with standard variables
    const enhancedContext = {
      ...context,
      appName: this.appName,
      appUrl: this.appUrl,
      batchId,
      currentYear: new Date().getFullYear(),
    };

    // Split recipients into batches
    const batches = [];
    for (let i = 0; i < recipients.length; i += batchSize) {
      batches.push(recipients.slice(i, i + batchSize));
    }

    // Queue each batch
    let queued = 0;
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      await this.emailQueue.add({
        name: 'send-bulk',
        batchId,
        recipients: batch,
        template,
        subject,
        context: enhancedContext,
        campaignId: options.campaignId,
        tags: options.tags,
        userId: options.userId
      }, {
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 10000,
        },
        removeOnComplete: true,
      });
      queued += batch.length;
    }

    this.logger.log(`Bulk email job queued with batch ID ${batchId} for ${queued} recipients`);
    return { batchId, queued };
  }

  /**
   * Get email status by ID
   */
  async getEmailStatus(emailId: string): Promise<EmailLog | null> {
    return this.emailLogRepository.findOne({ where: { emailId } });
  }

  /**
   * Get email log by ID
   */
  async getEmail(id: string): Promise<EmailLog | null> {
    return this.emailLogRepository.findOne({ where: { id } });
  }

  /**
   * Track campaign open
   */
  async trackCampaignOpen(campaignId: string, data: Record<string, any> = {}): Promise<void> {
    if (!campaignId) {
      this.logger.warn('Attempted to track campaign open without campaignId');
      return;
    }

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
    if (!event || typeof handler !== 'function') {
      this.logger.warn('Invalid webhook registration attempt');
      return;
    }
  
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
  if (!event) {
    this.logger.warn('Attempted to register empty webhook event type');
    return;
  }

  if (!this.webhookHandlers.has(event)) {
    this.webhookHandlers.set(event, []);
  }
}

  /**
   * Trigger webhook
   */
/**
 * Trigger webhook
 */
triggerWebhook(event: string, data: any): void {
  if (!event || !data) {
    this.logger.warn('Attempted to trigger webhook with invalid parameters');
    return;
  }

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
      isActive?: boolean;
      version?: number;
      lastEditor?: string;
      previewText?: string;
      category?: string;
    } = {}
  ): Promise<EmailTemplate> {
    if (!name || !content) {
      throw new Error('Template name and content are required');
    }

    // Validate template syntax
    try {
      Handlebars.compile(content);
    } catch (error) {
      throw new Error(`Invalid template syntax: ${error.message}`);
    }
    
    // Find existing template
    let template = await this.templateRepository.findOne({ where: { name } });
    
    if (template) {
      // Update existing template
      template.content = content;
      if (data.subject !== undefined) template.subject = data.subject;
      if (data.description !== undefined) template.description = data.description;
      if (data.isActive !== undefined) template.isActive = data.isActive;
      if (data.version !== undefined) template.version = data.version;
      if (data.lastEditor !== undefined) template.lastEditor = data.lastEditor;
      if (data.previewText !== undefined) template.previewText = data.previewText;
      if (data.category !== undefined) template.category = data.category;
      
      // Increment version
      template.version = (template.version || 0) + 1;
    } else {
      // Create new template
      template = this.templateRepository.create({
        name,
        content,
        subject: data.subject,
        description: data.description,
        isActive: data.isActive !== undefined ? data.isActive : true,
        version: data.version || 1,
        lastEditor: data.lastEditor,
        previewText: data.previewText,
        category: data.category,
      });
    }
    
    const savedTemplate = await this.templateRepository.save(template);
    
    // Update template in cache
    this.cachedTemplates.set(name, Handlebars.compile(content));
    
    return savedTemplate;
  }
  
  /**
   * Get email logs with filters
   */
  async getEmailLogs(
    filters: Record<string, any> = {}, 
    page = 1, 
    limit = 20
  ): Promise<{ data: EmailLog[]; total: number; page: number; pages: number }> {
    const where: any = {};
    
    // Process filters
    if (filters.status) {
      where.status = filters.status;
    }
    
    if (filters.template) {
      where.template = filters.template;
    }
    
    if (filters.search) {
      where.to = Like(`%${filters.search}%`);
    }
    
    if (filters.campaignId) {
      where.campaignId = filters.campaignId;
    }
    
    if (filters.userId) {
      where.userId = filters.userId;
    }
    
    if (filters.start && filters.end) {
      where.createdAt = Between(
        new Date(filters.start), 
        new Date(filters.end)
      );
    }
    
    // Get data with pagination
    const [data, total] = await this.emailLogRepository.findAndCount({
      where,
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
      emailLog.context || {}, // Ensure context is not null
      {
        tags: emailLog.tags || [],
        campaignId: emailLog.campaignId,
        userId: emailLog.userId
      }
    );
    
    // Update the original email log with reference to the resend
    emailLog.resendId = newEmailId;
    await this.emailLogRepository.save(emailLog);
    
    return newEmailId;
  }
  
  /**
   * Reload a template from the database into the cache
   */
  private async reloadTemplate(templateName: string): Promise<void> {
    try {
      const template = await this.templateRepository.findOne({
        where: { name: templateName },
      });
      
      if (template) {
        this.cachedTemplates.set(
          template.name, 
          Handlebars.compile(template.content)
        );
        this.logger.log(`Reloaded template: ${template.name}`);
      }
    } catch (error) {
      this.logger.error(`Failed to reload template: ${error.message}`, error.stack);
    }
  }
  
  /**
   * Get all templates with optional filters
   */
  async getTemplates(filters: {
    isActive?: boolean;
    category?: string;
    search?: string;
  } = {}): Promise<EmailTemplate[]> {
    const where: any = {};
    
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }
    
    if (filters.category) {
      where.category = filters.category;
    }
    
    if (filters.search) {
      where.name = Like(`%${filters.search}%`);
    }
    
    return this.templateRepository.find({
      where,
      order: { updatedAt: 'DESC' }
    });
  }
  
  /**
   * Delete a template by name
   */
  async deleteTemplate(name: string): Promise<boolean> {
    if (!name) {
      throw new Error('Template name is required');
    }

    // Check if template exists first
    const template = await this.templateRepository.findOne({ where: { name } });
    if (!template) {
      return false; // Template doesn't exist
    }
    
    const result = await this.templateRepository.delete({ name });
    
    if (result.affected && result.affected > 0) {
      // Remove from cache
      this.cachedTemplates.delete(name);
      return true;
    }
    
    return false;
  }
  
  /**
   * Get analytics for sent emails
   */
  async getEmailAnalytics(
    startDate: Date,
    endDate: Date,
    filters: { campaignId?: string; template?: string; userId?: string } = {}
  ): Promise<any> {
    if (!startDate || !endDate) {
      throw new Error('Start and end dates are required');
    }

    const where: any = {
      createdAt: Between(startDate, endDate)
    };
    
    if (filters.campaignId) {
      where.campaignId = filters.campaignId;
    }
    
    if (filters.template) {
      where.template = filters.template;
    }
    
    if (filters.userId) {
      where.userId = filters.userId;
    }
    
    // Get total counts
    const [
      total,
      sent,
      delivered,
      opened,
      clicked,
      bounced,
      failed
    ] = await Promise.all([
      this.emailLogRepository.count({ where }),
      this.emailLogRepository.count({ where: { ...where, status: 'sent' } }),
      this.emailLogRepository.count({ where: { ...where, status: 'delivered' } }),
      this.emailLogRepository.count({ where: { ...where, status: 'opened' } }),
      this.emailLogRepository.count({ where: { ...where, status: 'clicked' } }),
      this.emailLogRepository.count({ where: { ...where, status: 'bounced' } }),
      this.emailLogRepository.count({ where: { ...where, status: 'failed' } }),
    ]);
    
    // Calculate rates
    const deliveryRate = total > 0 ? (delivered / total) * 100 : 0;
    const openRate = delivered > 0 ? (opened / delivered) * 100 : 0;
    const clickRate = opened > 0 ? (clicked / opened) * 100 : 0;
    const bounceRate = total > 0 ? (bounced / total) * 100 : 0;
    const failureRate = total > 0 ? (failed / total) * 100 : 0;
    
    return {
      period: {
        start: startDate,
        end: endDate,
      },
      metrics: {
        total,
        sent,
        delivered,
        opened,
        clicked,
        bounced,
        failed,
      },
      rates: {
        delivery: parseFloat(deliveryRate.toFixed(2)),
        open: parseFloat(openRate.toFixed(2)),
        click: parseFloat(clickRate.toFixed(2)),
        bounce: parseFloat(bounceRate.toFixed(2)),
        failure: parseFloat(failureRate.toFixed(2)),
      },
    };
  }
}