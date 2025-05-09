// src/email/email.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as nodemailer from 'nodemailer';
import * as Handlebars from 'handlebars';
import { v4 as uuidv4 } from 'uuid';
import { IEmailService, EmailOptions, LoginInfo } from './email.port';
import { EmailLog, EmailStatus } from './entities/email-log.entity';
import { EmailTemplate } from './entities/email-template.entity';
// import { EVENT_EMITTER_TOKEN } from '../common/events/event-emitter.di-token';
import { EventEmitter } from 'events';
import { EVENT_EMITTER_TOKEN } from 'src/common/events/event-emitter.di-token';
import path from 'path';
import * as fs from 'fs';

@Injectable()
export class EmailService implements IEmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private isProduction: boolean;
  private defaultFromEmail: string;
  private appUrl: string;
  private templateCache: Map<string, Handlebars.TemplateDelegate> = new Map();

  constructor(
    @InjectRepository(EmailLog)
    private emailLogRepository: Repository<EmailLog>,
    @InjectRepository(EmailTemplate)
    private emailTemplateRepository: Repository<EmailTemplate>,
    @InjectQueue('email')
    private emailQueue: Queue,
    private configService: ConfigService,
    @Inject(EVENT_EMITTER_TOKEN)
    private eventEmitter: EventEmitter,
  ) {
    this.isProduction = configService.get('NODE_ENV') === 'production';
    this.defaultFromEmail = configService.get<string>(
      'EMAIL_FROM',
      'SecureMail <no-reply@securemail.com>',
    );
    this.appUrl = configService.get<string>('APP_URL', 'http://localhost:3000');

    // Initialize SMTP transporter based on environment
    this.initializeTransporter();
    this.logger.log(`Transporter initialized: ${!!this.transporter}`);
    // Initialize Handlebars helpers
    this.registerHandlebarsHelpers();

    // Register partials - this will create default partials if they don't exist
    this.registerPartials().catch((error) => {
      this.logger.error(
        `Failed to register partials: ${error.message}`,
        error.stack,
      );
    });
  }

  private async initializeTransporter() {
    // Common configuration for both production and development
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass =
      this.configService.get<string>('SMTP_PASSWORD') ||
      this.configService.get<string>('SMTP_PASS');
    const secure = false;
    const appPassword = this.configService.get<string>(
      'EMAIL_APP_PASSWORD_GOOGLE',
    );
    this.logger.log(
      `Setting up SMTP---->: ${host}:${port} (secure: ${secure})`,
    );

    if (!host || !port || !user || !pass) {
      this.logger.error(
        'Missing SMTP configuration. Check your environment variables.',
      );
      return;
    }

    if (this.isProduction) {
      // Production configuration
      this.transporter = nodemailer.createTransport({
        host: this.configService.get<string>('SMTP_HOST'),
        port: this.configService.get<number>('SMTP_PORT'),
        // secure: this.configService.get<boolean>('SMTP_SECURE', true),
        auth: {
          user: this.configService.get<string>('SMTP_USER'),
          pass: this.configService.get<string>('SMTP_PASSWORD'),
        },
        pool: true, // Use pooled connection for better performance
        maxConnections: 5,
        maxMessages: 100,
      });
    } else {
      // Development configuration - Use Ethereal for testing
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure, // This should match your server requirements
        auth: {
          user,
          pass: appPassword,
        },
        tls: {
          // Do not fail on invalid certificates
          rejectUnauthorized: false,
        },
      });
      this.logger.log(
        `Development email account: ${testAccount.user} / ${testAccount.pass}`,
      );
    }

    // Verify connection
    await new Promise<void>((resolve, reject) => {
      this.transporter.verify((error) => {
        if (error) {
          this.logger.error('SMTP connection error:', error);
          reject(error);
        } else {
          this.logger.log('SMTP server is ready to send emails');
          resolve();
        }
      });
    });
  }

  private registerHandlebarsHelpers() {
    // Add Handlebars helper for formatting dates
    Handlebars.registerHelper(
      'formatDate',
      function (date: Date, format: string) {
        // Simple date formatting implementation
        // In a real app, use a library like date-fns or moment
        console.log('format', format);
        if (!date) return '';
        try {
          const d = new Date(date);
          return d.toLocaleDateString();
        } catch (e) {
          console.log('error', e);
          return date;
        }
      },
    );

    // Add helper for conditional logic
    Handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
      switch (operator) {
        case '==':
          return v1 == v2 ? options.fn(this) : options.inverse(this);
        case '===':
          return v1 === v2 ? options.fn(this) : options.inverse(this);
        case '!=':
          return v1 != v2 ? options.fn(this) : options.inverse(this);
        case '!==':
          return v1 !== v2 ? options.fn(this) : options.inverse(this);
        case '<':
          return v1 < v2 ? options.fn(this) : options.inverse(this);
        case '<=':
          return v1 <= v2 ? options.fn(this) : options.inverse(this);
        case '>':
          return v1 > v2 ? options.fn(this) : options.inverse(this);
        case '>=':
          return v1 >= v2 ? options.fn(this) : options.inverse(this);
        case '&&':
          return v1 && v2 ? options.fn(this) : options.inverse(this);
        case '||':
          return v1 || v2 ? options.fn(this) : options.inverse(this);
        default:
          return options.inverse(this);
      }
    });
  }

  /**
   * Queue an email to be sent
   */
  async queueEmail(
    to: string | string[],
    subject: string,
    template: string,
    context: Record<string, any>,
    options: EmailOptions = {},
  ): Promise<string> {
    const emailId = uuidv4();

    // Process recipients
    const recipients = Array.isArray(to) ? to : [to];

    try {
      // Create log entry
      const emailLog = this.emailLogRepository.create({
        emailId,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        template,
        context,
        status: EmailStatus.PENDING,
        ...options,
      });
      await this.emailLogRepository.save(emailLog);

      // Add to processing queue
      await this.emailQueue.add(
        'send',
        {
          emailId,
          to: recipients,
          subject,
          template,
          context,
          options: {
            ...options,
            from: options.from || this.defaultFromEmail,
          },
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: true,
          delay: options.deliveryTime
            ? new Date(options.deliveryTime).getTime() - Date.now()
            : 0,
        },
      );

      this.logger.log(`Email queued: ${emailId} to ${recipients.join(', ')}`);
    } catch (error) {
      this.logger.error(`Failed to queue email: ${error.message}`, error.stack);
      throw new Error(`Failed to queue email: ${error.message}`);
    }

    return emailId;
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(
    email: string,
    name: string,
    token: string,
  ): Promise<string> {
    const verificationLink = `${this.appUrl}/auth/verify-email/${token}`;

    const emailId = uuidv4();
    await this.queueEmail(
      email,
      'Verify Your Email',
      'verification',
      {
        name,
        verificationLink,
        appName: this.configService.get<string>('APP_NAME', 'SecureMail'),
        supportEmail: this.configService.get<string>(
          'SUPPORT_EMAIL',
          'support@securemail.com',
        ),
      },
      {
        tags: ['verification', 'onboarding'],
        trackOpens: true,
        trackClicks: true,
      },
    );
    return emailId;
  }

  /**
   * Send verification code email
   */
  async sendVerificationCode(
    email: string,
    name: string,
    code: string,
  ): Promise<string> {
    const emailId = uuidv4();
    await this.queueEmail(
      email,
      'Verify Your Registration',
      'verification-code',
      {
        name: name || 'User',
        verificationCode: code,
        appName: this.configService.get<string>('APP_NAME', 'SecureMail'),
        supportEmail: this.configService.get<string>(
          'SUPPORT_EMAIL',
          'support@securemail.com',
        ),
        expiresIn: '30 minutes',
      },
      {
        tags: ['verification', 'registration'],
        priority: 'high',
        trackOpens: true,
      },
    );
    return emailId;
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    email: string,
    name: string,
    token: string,
  ): Promise<string> {
    const resetLink = `${this.appUrl}/auth/reset-password/${token}`;
    const emailId = uuidv4();
    await this.queueEmail(
      email,
      'Reset Your Password',
      'password-reset',
      {
        name,
        resetLink,
        appName: this.configService.get<string>('APP_NAME', 'SecureMail'),
        supportEmail: this.configService.get<string>(
          'SUPPORT_EMAIL',
          'support@securemail.com',
        ),
        expiresIn: '1 hour',
      },
      {
        tags: ['password-reset', 'security'],
        priority: 'high',
        trackOpens: true,
        trackClicks: true,
      },
    );
    return emailId;
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email: string, name: string): Promise<string> {
    const emailId = uuidv4();
    await this.queueEmail(
      email,
      'Welcome to SecureMail',
      'welcome',
      {
        name,
        loginUrl: `${this.appUrl}/auth/login`,
        appName: this.configService.get<string>('APP_NAME', 'SecureMail'),
        supportEmail: this.configService.get<string>(
          'SUPPORT_EMAIL',
          'support@securemail.com',
        ),
        dashboardUrl: `${this.appUrl}/dashboard`,
        docsUrl: `${this.appUrl}/docs`,
      },
      {
        tags: ['welcome', 'onboarding'],
        trackOpens: true,
        trackClicks: true,
      },
    );
    return emailId;
  }

  /**
   * Send login notification
   */
  async sendLoginNotification(
    email: string,
    name: string,
    loginInfo: LoginInfo,
  ): Promise<void> {
    await this.queueEmail(
      email,
      'New Login to Your Account',
      'login-notification',
      {
        name,
        loginInfo: {
          device: loginInfo.device || 'Unknown device',
          location: loginInfo.location || 'Unknown location',
          ipAddress: loginInfo.ipAddress || 'Unknown IP',
          time: loginInfo.time || new Date(),
          isNewDevice: loginInfo.isNewDevice || false,
        },
        securitySettingsUrl: `${this.appUrl}/settings/security`,
        appName: this.configService.get<string>('APP_NAME', 'SecureMail'),
        supportEmail: this.configService.get<string>(
          'SUPPORT_EMAIL',
          'support@securemail.com',
        ),
      },
      {
        tags: ['security', 'login-notification'],
        priority: loginInfo.isNewDevice ? 'high' : 'normal',
        trackOpens: true,
      },
    );
  }

  /**
   * Send magic link email
   * @param email User's email address
   * @param name User's name
   * @param token Magic link token
   */
  async sendMagicLinkEmail(
    email: string,
    name: string,
    token: string,
  ): Promise<void> {
    const magicLink = `${this.appUrl}/auth/verify-magic-link/${token}`;

    await this.queueEmail(
      email,
      'Sign In to Your Account',
      'magic-link',
      {
        name,
        magicLink,
        expiresIn: '15 minutes',
        appName: this.configService.get<string>('APP_NAME', 'SecureMail'),
        supportEmail: this.configService.get<string>(
          'SUPPORT_EMAIL',
          'support@securemail.com',
        ),
      },
      {
        tags: ['magic-link', 'login'],
        priority: 'high',
        trackOpens: true,
        trackClicks: true,
      },
    );
  }

  // Add this method to the EmailService class in email.service.ts

  /**
   * Register Handlebars partials from database
   */
  private async registerPartials(): Promise<void> {
    try {
      // Find all email templates that are meant to be partials (name starts with 'partial-')
      const partials = await this.emailTemplateRepository.find({
        where: {
          name: Like('partial-%'),
          isActive: true,
        },
      });

      if (partials.length === 0) {
        // Create default partials if none exist
        await this.createDefaultPartials();

        // Fetch the newly created partials
        const newPartials = await this.emailTemplateRepository.find({
          where: {
            name: Like('partial-%'),
            isActive: true,
          },
        });

        // Register the newly created partials
        for (const partial of newPartials) {
          const partialName = partial.name.replace('partial-', '');
          Handlebars.registerPartial(partialName, partial.content);
          this.logger.log(`Registered partial: ${partialName}`);
        }
      } else {
        // Register existing partials
        for (const partial of partials) {
          const partialName = partial.name.replace('partial-', '');
          Handlebars.registerPartial(partialName, partial.content);
          this.logger.log(`Registered partial: ${partialName}`);
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to register partials: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Create default header and footer partials
   */
  private async createDefaultPartials(): Promise<void> {
    try {
      // Create header partial
      const headerTemplate = this.emailTemplateRepository.create({
        name: 'partial-header',
        content: `<header style="background-color: #f8f9fa; padding: 20px; text-align: center; border-bottom: 1px solid #e9ecef;">
  <h2>{{appName}}</h2>
</header>`,
        description: 'Default header partial for emails',
        isActive: true,
        version: 1,
        category: 'system',
      });

      // Create footer partial
      const footerTemplate = this.emailTemplateRepository.create({
        name: 'partial-footer',
        content: `<footer style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; text-align: center; color: #6c757d; font-size: 0.9em;">
  <p>© {{currentYear}} {{appName}}. All rights reserved.</p>
  <p>If you have any questions, please contact us.</p>
</footer>`,
        description: 'Default footer partial for emails',
        isActive: true,
        version: 1,
        category: 'system',
      });

      await this.emailTemplateRepository.save([headerTemplate, footerTemplate]);
      this.logger.log('Created default email partials');
    } catch (error) {
      this.logger.error(
        `Failed to create default partials: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Get template content and compile with Handlebars
   * @param templateName Name of the template
   * @param context Data to inject into template
   * @returns Compiled HTML content
   */
  private async compileTemplate(
    templateName: string,
    context: Record<string, any>,
  ): Promise<string> {
    try {
      // Check template cache first
      if (!this.templateCache.has(templateName)) {
        // Get template from database
        const templateEntity = await this.emailTemplateRepository.findOne({
          where: { name: templateName, isActive: true },
        });

        if (!templateEntity) {
          // Try to find template in filesystem as fallback
          const templatePath = path.join(
            process.cwd(),
            'templates/emails',
            `${templateName}.hbs`,
          );

          if (fs.existsSync(templatePath)) {
            this.logger.warn(
              `Template "${templateName}" not found in database, loading from filesystem and creating in database...`,
            );

            const content = fs.readFileSync(templatePath, 'utf8');

            // Create template in database
            const newTemplate = this.emailTemplateRepository.create({
              name: templateName,
              content,
              description: `Template for ${templateName.replace(/-/g, ' ')}`,
              isActive: true,
              version: 1,
              category:
                templateName.includes('auth') ||
                templateName.includes('verification') ||
                templateName.includes('password') ||
                templateName.includes('magic-link')
                  ? 'authentication'
                  : 'notification',
            });

            await this.emailTemplateRepository.save(newTemplate);

            // Make sure partials are registered before compiling
            await this.registerPartials();

            // Parse with Handlebars and cache
            const template = Handlebars.compile(content);
            this.templateCache.set(templateName, template);
          } else {
            throw new Error(
              `Email template "${templateName}" not found in database or filesystem`,
            );
          }
        } else {
          // Make sure partials are registered before compiling
          await this.registerPartials();

          // Parse with Handlebars and cache
          const template = Handlebars.compile(templateEntity.content);
          this.templateCache.set(templateName, template);
        }
      }

      // Get template from cache
      const template = this.templateCache.get(templateName);

      // Add common context variables
      const fullContext = {
        ...context,
        appName: this.configService.get<string>('APP_NAME', 'SecureMail'),
        currentYear: new Date().getFullYear(),
        appUrl: this.appUrl,
      };

      // Compile and return HTML
      return template(fullContext);
    } catch (error) {
      // If the error is about missing partials, try to fix it
      if (
        error.message &&
        error.message.includes('partial') &&
        error.message.includes('not found')
      ) {
        this.logger.warn(
          `Missing partial detected: ${error.message}. Attempting recovery...`,
        );

        // Force reregister of partials and clear template cache
        await this.registerPartials();
        this.templateCache.delete(templateName);

        // Try again one more time
        return this.compileTemplate(templateName, context);
      }

      this.logger.error(
        `Template compilation error: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to compile email template: ${error.message}`);
    }
  }

  // private async compileTemplate(
  //   templateName: string,
  //   context: Record<string, any>,
  // ): Promise<string> {
  //   try {
  //     // Check template cache first
  //     if (!this.templateCache.has(templateName)) {
  //       // Get template from database
  //       const templateEntity = await this.emailTemplateRepository.findOne({
  //         where: { name: templateName, isActive: true },
  //       });

  //       if (!templateEntity) {
  //         throw new Error(
  //           `Email template "${templateName}" not found or inactive`,
  //         );
  //       }

  //       // Make sure partials are registered before compiling
  //       await this.registerPartials();

  //       // Parse with Handlebars and cache
  //       const template = Handlebars.compile(templateEntity.content);
  //       this.templateCache.set(templateName, template);
  //     }

  //     // Get template from cache
  //     const template = this.templateCache.get(templateName);

  //     // Add common context variables
  //     const fullContext = {
  //       ...context,
  //       appName: this.configService.get<string>('APP_NAME', 'SecureMail'),
  //       currentYear: new Date().getFullYear(),
  //       appUrl: this.appUrl,
  //     };

  //     // Compile and return HTML
  //     return template(fullContext);
  //   } catch (error) {
  //     // If the error is about missing partials, try to fix it
  //     if (
  //       error.message &&
  //       error.message.includes('partial') &&
  //       error.message.includes('not found')
  //     ) {
  //       this.logger.warn(
  //         `Missing partial detected: ${error.message}. Attempting recovery...`,
  //       );

  //       // Force reregister of partials and clear template cache
  //       await this.registerPartials();
  //       this.templateCache.delete(templateName);

  //       // Try again one more time
  //       return this.compileTemplate(templateName, context);
  //     }

  //     this.logger.error(
  //       `Template compilation error: ${error.message}`,
  //       error.stack,
  //     );
  //     throw new Error(`Failed to compile email template: ${error.message}`);
  //   }
  // }

  /**
   * Process and send an email directly (called from queue processor)
   * @param data Email data from queue
   */
  async processQueuedEmail(data: any): Promise<void> {
    const { emailId, to, subject, template, context, options } = data;
    this.logger.debug(`Starting to process email ${emailId} to ${to}`);

    try {
      // Update status to processing
      await this.emailLogRepository.update(
        { emailId },
        {
          status: EmailStatus.PROCESSING,
          attempts: () => '"attempts" + 1',
        },
      );
      this.logger.debug(`Compiling template ${template}`);
      // Compile template
      const html = await this.compileTemplate(template, context);
      this.logger.debug(`Template compiled successfully`);
      // Prepare mail options
      const mailOptions: nodemailer.SendMailOptions = {
        from: options.from || this.defaultFromEmail,
        to,
        subject,
        html,
        ...options,
      };

      mailOptions.headers = {
        'Message-ID': `<${emailId}@dnsecure>`,
        'List-Unsubscribe': `<${this.appUrl}/unsubscribe/${emailId}>`,
        'X-Entity-Ref-ID': emailId,
      };

      // Add tracking pixel if enabled
      if (options.trackOpens) {
        // Add tracking pixel
        mailOptions.html += `<img src="${this.appUrl}/api/email/track/${emailId}/open" width="1" height="1" alt="" style="display:none">`;
      }

      // Track links if enabled
      if (options.trackClicks && mailOptions.html) {
        // Replace all links with tracking links
        // This is a simplified implementation - a production version would use an HTML parser
        if (typeof mailOptions.html === 'string') {
          mailOptions.html = mailOptions.html.replace(
            /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi,
            (match, quote, url) => {
              // Skip tracking for unsubscribe and anchor links
              if (url.startsWith('#') || url.includes('unsubscribe')) {
                return match;
              }
              return `<a href="${this.appUrl}/api/email/track/${emailId}/click?url=${encodeURIComponent(url)}"`;
            },
          );
        }
      }

      // Send email
      const result = await this.transporter.sendMail(mailOptions);

      // Update email log with success
      await this.emailLogRepository.update(
        { emailId },
        {
          status: EmailStatus.SENT,
          messageId: result.messageId,
          sentAt: new Date(),
          lastStatusAt: new Date(),
        },
      );

      // Emit event for webhooks
      this.eventEmitter.emit('email.sent', {
        emailId,
        to,
        subject,
        template,
        messageId: result.messageId,
      });

      this.logger.log(
        `Email sent: ${emailId} to ${to} with message ID ${result.messageId}`,
      );

      // Log preview URL for development
      if (!this.isProduction && result.preview) {
        this.logger.log(`Email preview URL: ${result.preview}`);
      }
    } catch (error) {
      // Update email log with error
      await this.emailLogRepository.update(
        { emailId },
        {
          status: EmailStatus.FAILED,
          error: error.message,
          lastStatusAt: new Date(),
        },
      );

      this.logger.error(
        `Failed to send email ${emailId}: ${error.message}`,
        error.stack,
      );

      // Emit event for webhooks
      this.eventEmitter.emit('email.failed', {
        emailId,
        to,
        subject,
        template,
        error: error.message,
      });

      // Rethrow error for the queue to handle retries
      throw error;
    }
  }

  /**
   * Send 2FA backup codes email
   * @param email User's email address
   * @param name User's name
   * @param backupCodes Array of backup codes
   */
  async sendTwoFactorBackupCodesEmail(
    email: string,
    name: string,
    backupCodes: string[],
  ): Promise<string> {
    const emailId = uuidv4();

    await this.queueEmail(
      email,
      'Your Two-Factor Authentication Backup Codes',
      '2fa-backup-codes',
      {
        name,
        backupCodes,
        securitySettingsUrl: `${this.appUrl}/settings/security`,
        appName: this.configService.get<string>('APP_NAME', 'SecureMail'),
        supportEmail: this.configService.get<string>(
          'SUPPORT_EMAIL',
          'support@securemail.com',
        ),
      },
      {
        tags: ['2fa', 'security'],
        priority: 'high',
        trackOpens: true,
      },
    );

    return emailId;
  }

  private checkSpamContent(
    subject: string,
    htmlContent: string,
  ): { score: number; warnings: string[] } {
    const warnings = [];
    let score = 0;

    // Danh sách từ khóa spam phổ biến
    const spamKeywords = [
      'free',
      'miễn phí',
      'giảm giá',
      '$$$',
      'best price',
      'buy now',
      'mua ngay',
      'click here',
      'bấm vào đây',
      'winner',
      'guaranteed',
      'đảm bảo',
      'urgent',
      'khẩn cấp',
    ];

    // Kiểm tra chủ đề
    const subjectUppercase = (subject.match(/[A-Z]/g) || []).length;
    const subjectTotal = subject.length;
    if (subjectUppercase / subjectTotal > 0.3) {
      score += 1;
      warnings.push('Chữ viết hoa quá nhiều trong tiêu đề');
    }

    // Kiểm tra nội dung cho các từ khóa spam
    const content = htmlContent.replace(/<[^>]*>/g, ' '); // Loại bỏ HTML
    spamKeywords.forEach((keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = content.match(regex);
      if (matches && matches.length > 0) {
        score += 0.5;
        warnings.push(
          `Từ khóa spam tiềm năng: "${keyword}" (${matches.length} lần)`,
        );
      }
    });

    // Kiểm tra dấu chấm than quá nhiều
    const exclamationCount = (content.match(/!/g) || []).length;
    if (exclamationCount > 3) {
      score += 0.5;
      warnings.push(`Quá nhiều dấu chấm than (${exclamationCount})`);
    }

    return { score, warnings };
  }

  async handleBounce(emailId: string, reason: string): Promise<void> {
    // Cập nhật trạng thái email
    await this.emailLogRepository.update(
      { emailId },
      {
        status: EmailStatus.BOUNCED,
        error: reason,
        lastStatusAt: new Date(),
      },
    );

    // Lấy thông tin email
    const emailLog = await this.emailLogRepository.findOne({
      where: { emailId },
    });

    if (emailLog) {
      // Thêm địa chỉ email vào danh sách đen hoặc đánh dấu là không hợp lệ
      // trong cơ sở dữ liệu người dùng của bạn
      this.logger.warn(`Email ${emailLog.to} bị bounce: ${reason}`);

      // Thông báo cho quản trị viên
      this.eventEmitter.emit('email.bounced', {
        emailId,
        to: emailLog.to,
        reason,
      });
    }
  }
}
