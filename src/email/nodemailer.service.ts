import { Injectable, Logger } from '@nestjs/common';
import { IEmailService } from './email.port';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { EventEmitter2 } from '@nestjs/event-emitter';
// import { SentMessageInfo } from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import { OAuth2Service } from './oauth2.service';
import { EmailTemplate } from './entities/email-template.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { EmailJob } from './interfaces/email-job.interface';
import { InjectQueue } from '@nestjs/bullmq';

export interface WebhookEvent {
  id: string;
  event:
    | 'sent'
    | 'delivered'
    | 'opened'
    | 'clicked'
    | 'bounced'
    | 'complained'
    | 'failed';
  emailId: string;
  recipient: string;
  timestamp: Date;
  metadata?: any;
}
type WebhookHandler = (data: WebhookEvent) => void;
@Injectable()
export class NodemailerService implements IEmailService {
  private readonly logger = new Logger(NodemailerService.name);
  private transporter: nodemailer.Transporter;
  private readonly templatesDir: string;
  private readonly templates: Map<string, HandlebarsTemplateDelegate> =
    new Map();
  private readonly appName: string;
  private readonly appUrl: string;
  private readonly fromEmail: string;
  private readonly emailJobs: Map<string, EmailJob> = new Map();
  private readonly webhookHandlers: Map<string, WebhookHandler[]> = new Map();
  private readonly MAX_RETRIES = 3;
  // private worker: Worker;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly oauth2Service: OAuth2Service,
    @InjectRepository(EmailTemplate)
    private readonly templateRepository: Repository<EmailTemplate>,
    @InjectQueue('email')
    private readonly emailQueue: Queue,
  ) {
    // Initialize email configuration
    this.appName = this.configService.get<string>('APP_NAME', 'Your App');
    this.appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );
    this.fromEmail = this.configService.get<string>(
      'EMAIL_FROM',
      `"${this.appName}" <noreply@example.com>`,
    );

    // Set up templates directory
    this.templatesDir = path.join(__dirname, '../../templates/emails');
    this.loadTemplates();

    // Create worker for processing emails
    // this.setupWorker();

    // Create Nodemailer transporter with connection pool
    const useTestAccount =
      this.configService.get<string>('EMAIL_USE_TEST_ACCOUNT', 'false') ===
      'true';
    if (useTestAccount) {
      this.createTestTransporter();
    } else {
      this.createProductionTransporter();
    }

    // Register webhook event types
    this.registerWebhookEventType('sent');
    this.registerWebhookEventType('delivered');
    this.registerWebhookEventType('opened');
    this.registerWebhookEventType('clicked');
    this.registerWebhookEventType('bounced');
    this.registerWebhookEventType('complained');
    this.registerWebhookEventType('failed');
  }

  // private setupWorker() {
  //   const redisClient = new Redis({
  //     host: this.configService.get<string>('REDIS_HOST', 'localhost'),
  //     port: this.configService.get<number>('REDIS_PORT', 6380),
  //     password: this.configService.get<string>('REDIS_PASSWORD'),
  //     maxRetriesPerRequest: null,
  //   });

  //   this.worker = new Worker(
  //     'email',
  //     async (job) => {
  //       return this.processEmailJob(job.data);
  //     },
  //     {
  //       connection: redisClient,
  //     },
  //   );

  //   this.worker.on('completed', (job) => {
  //     const emailJob = job.data;
  //     this.logger.log(`Email job ${emailJob.id} completed successfully`);
  //     this.updateJobStatus(emailJob.id, 'sent', {
  //       sentAt: new Date(),
  //       messageId: emailJob.messageId,
  //     });
  //     this.triggerWebhook('sent', {
  //       id: uuidv4(),
  //       event: 'sent',
  //       emailId: emailJob.id,
  //       recipient: emailJob.to,
  //       timestamp: new Date(),
  //     });
  //   });

  //   this.worker.on('failed', (job, error) => {
  //     if (!job) return;

  //     const emailJob = job.data;
  //     this.logger.error(`Email job ${emailJob.id} failed: ${error.message}`);

  //     if (job.attemptsMade >= this.MAX_RETRIES) {
  //       this.updateJobStatus(emailJob.id, 'failed', { error: error.message });
  //       this.triggerWebhook('failed', {
  //         id: uuidv4(),
  //         event: 'failed',
  //         emailId: emailJob.id,
  //         recipient: emailJob.to,
  //         timestamp: new Date(),
  //         metadata: { error: error.message, attempts: job.attemptsMade },
  //       });
  //     }
  //   });
  // }

  // Implement IEmailService methods
  // Sửa các phương thức để trả về Promise<string>

  async sendVerificationEmail(
    to: string,
    name: string | null,
    token: string,
  ): Promise<string> {
    const verificationUrl = `${this.appUrl}/auth/verify-email/${token}`;
    const context = {
      appName: this.appName,
      name: name || 'User',
      verificationUrl,
    };

    return this.queueEmail(
      to,
      `Verify your email for ${this.appName}`,
      'verification',
      context,
    );
  }

  async sendPasswordResetEmail(
    to: string,
    name: string | null,
    token: string,
  ): Promise<string> {
    const resetUrl = `${this.appUrl}/auth/reset-password/${token}`;
    const context = {
      appName: this.appName,
      name: name || 'User',
      resetUrl,
    };

    return this.queueEmail(
      to,
      `Reset your password for ${this.appName}`,
      'password-reset',
      context,
    );
  }

  async sendWelcomeEmail(to: string, name: string | null): Promise<string> {
    const context = {
      appName: this.appName,
      name: name || 'User',
      loginUrl: `${this.appUrl}/auth/login`,
    };

    return this.queueEmail(
      to,
      `Welcome to ${this.appName}!`,
      'welcome',
      context,
    );
  }

  async sendTwoFactorBackupCodesEmail(
    to: string,
    name: string | null,
    codes: string[],
  ): Promise<string> {
    const context = {
      appName: this.appName,
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

  async sendLoginNotificationEmail(
    to: string,
    name: string | null,
    device: string,
    location: string,
    time: Date,
  ): Promise<string> {
    const context = {
      appName: this.appName,
      name: name || 'User',
      device,
      location,
      time: time.toLocaleString(),
      accountSettingsUrl: `${this.appUrl}/account/security`,
    };

    return this.queueEmail(
      to,
      `New login to your ${this.appName} account`,
      'login-notification',
      context,
    );
  }

  async sendLoginAttemptNotificationEmail(
    to: string,
    name: string | null,
    device: string,
    location: string,
    time: Date,
  ): Promise<string> {
    const context = {
      appName: this.appName,
      name: name || 'User',
      device,
      location,
      time: time.toLocaleString(),
      resetPasswordUrl: `${this.appUrl}/auth/forgot-password`,
    };

    return this.queueEmail(
      to,
      `Unusual login attempt on your ${this.appName} account`,
      'login-attempt',
      context,
    );
  }

  // Enhanced methods for webhook functionality
  registerWebhook(event: string, handler: WebhookHandler): void {
    if (!this.webhookHandlers.has(event)) {
      this.registerWebhookEventType(event);
    }

    const handlers = this.webhookHandlers.get(event) || [];
    handlers.push(handler);
    this.webhookHandlers.set(event, handlers);
    this.logger.log(`Registered webhook handler for event: ${event}`);
  }

  registerWebhookEventType(event: string): void {
    if (!this.webhookHandlers.has(event)) {
      this.webhookHandlers.set(event, []);
    }
  }

  triggerWebhook(event: string, data: WebhookEvent): void {
    const handlers = this.webhookHandlers.get(event) || [];
    handlers.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        this.logger.error(
          `Error in webhook handler for ${event}: ${error.message}`,
        );
      }
    });

    // Also emit as a NestJS event
    this.eventEmitter.emit(`email.${event}`, data);
  }

  // Email tracking methods
  async getEmailStatus(emailId: string): Promise<any> {
    return Promise.resolve(this.emailJobs.get(emailId));
  }

  getAllEmails(): EmailJob[] {
    return Array.from(this.emailJobs.values());
  }

  // Queue management
  async queueEmail(
    to: string,
    subject: string,
    template: string,
    context: any,
  ): Promise<string> {
    // Validate recipient
    if (!to || typeof to !== 'string' || to.trim() === '') {
      throw new Error('Email recipient is required and must be valid');
    }

    const emailId = uuidv4();

    const emailJob: EmailJob = {
      id: emailId,
      to: to.trim(), // Ensure clean email address
      subject,
      template,
      context: {
        ...context,
        id: emailId, // Add emailId to context for tracking
      },
      attempts: 0,
      status: 'pending',
    };

    this.emailJobs.set(emailId, emailJob);

    await this.emailQueue.add('send-email', emailJob, {
      attempts: this.MAX_RETRIES,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
    });

    this.logger.log(`Email queued with ID: ${emailId}`);

    return emailId;
  }

  private updateJobStatus(
    emailId: string,
    status: 'pending' | 'sent' | 'failed',
    updates: Partial<EmailJob> = {},
  ): void {
    const job = this.emailJobs.get(emailId);
    if (job) {
      this.emailJobs.set(emailId, { ...job, status, ...updates });
    }
  }

  private async processEmailJob(job: EmailJob): Promise<void> {
    try {
      job.attempts += 1;
      this.updateJobStatus(job.id, 'pending', { attempts: job.attempts });

      // Double-check recipient before sending
      if (!job.to || typeof job.to !== 'string' || job.to.trim() === '') {
        throw new Error('Email recipient is missing or invalid');
      }

      const compiledTemplate = this.getTemplate(job.template);
      if (!compiledTemplate) {
        throw new Error(`Email template '${job.template}' not found`);
      }

      // Make sure context includes the email ID
      const contextWithTracking = {
        ...job.context,
        id: job.id, // Ensure emailId is in context
        appUrl: this.appUrl, // Make sure appUrl is available
      };

      const html = compiledTemplate(contextWithTracking);

      const mailOptions = {
        from: this.fromEmail,
        to: job.to,
        subject: job.subject,
        html,
        headers: {
          'X-Email-ID': job.id,
        },
        dsn: {
          id: job.id,
          return: 'headers',
          notify: ['success', 'failure', 'delay'],
          recipient: this.configService.get<string>(
            'EMAIL_WEBHOOK_ENDPOINT',
            '',
          ),
        },
      };

      // Log mail options for debugging (remove sensitive info)
      this.logger.debug(
        `Sending email to: ${job.to} with subject: ${job.subject}`,
      );

      const info = await this.transporter.sendMail(mailOptions);

      // Update job with messageId
      this.updateJobStatus(job.id, 'pending', { messageId: info.messageId });

      if (
        this.configService.get<string>('EMAIL_USE_TEST_ACCOUNT', 'false') ===
        'true'
      ) {
        this.logger.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      }

      return;
    } catch (error) {
      this.logger.error(
        `Failed to send email (attempt ${job.attempts}): ${error.message}`,
        error.stack,
      );
      throw error; // Rethrow to let Bull handle the retry
    }
  }

  // Handler for DSN notifications (can be connected to a real webhook endpoint)
  processDSNNotification(notification: any): void {
    const emailId = notification.dsn?.id;
    if (!emailId) return;

    const status = notification.status?.type;
    let event: WebhookEvent['event'] = 'delivered';

    switch (status) {
      case 'delivered':
        event = 'delivered';
        break;
      case 'failed':
      case 'bounced':
        event = 'bounced';
        break;
      case 'delayed':
        // Handle delayed emails
        return;
      default:
        return;
    }

    this.triggerWebhook(event, {
      id: uuidv4(),
      event,
      emailId,
      recipient: notification.recipient,
      timestamp: new Date(),
      metadata: notification,
    });
  }

  // Transporter initialization methods
  private async createTestTransporter(): Promise<void> {
    try {
      // Create a test account using Ethereal
      const testAccount = await nodemailer.createTestAccount();

      this.transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
      });

      this.logger.log(`Created test email account: ${testAccount.user}`);
    } catch (error) {
      this.logger.error(
        `Failed to create test email transporter: ${error.message}`,
        error.stack,
      );
    }
  }

  private createProductionTransporter(): void {
    try {
      const emailHost = this.configService.get<string>(
        'EMAIL_HOST',
        'smtp.gmail.com',
      );
      const emailPort = this.configService.get<number>('EMAIL_PORT', 587);
      const emailSecure =
        this.configService.get<string>('EMAIL_SECURE', 'false') === 'true';
      const useOAuth =
        this.configService.get<string>('EMAIL_USE_OAUTH', 'false') === 'true';

      const transportConfig: any = {
        host: emailHost,
        port: emailPort,
        secure: emailSecure,
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
      };

      if (useOAuth && emailHost.includes('gmail')) {
        // Use OAuth2 for Gmail
        this.logger.log('Using OAuth2 authentication for Gmail');

        transportConfig.auth = {
          type: 'OAuth2',
          user: this.configService.get<string>('EMAIL_FROM'),
          clientId: this.configService.get<string>('GMAIL_CLIENT_ID'),
          clientSecret: this.configService.get<string>('GMAIL_CLIENT_SECRET'),
          refreshToken: this.configService.get<string>('GMAIL_REFRESH_TOKEN'),
          accessToken: 'to_be_fetched', // This will be fetched by the OAuth2Service
        };
      } else {
        // Use regular username/password if OAuth is not enabled
        transportConfig.auth = {
          user: this.configService.get<string>('EMAIL_USER'),
          pass: this.configService.get<string>('EMAIL_PASS'),
        };
      }

      this.transporter = nodemailer.createTransport(transportConfig);

      // Verify connection
      this.transporter.verify((error) => {
        if (error) {
          this.logger.error(`SMTP connection error: ${error.message}`);
        } else {
          this.logger.log('SMTP server is ready to send messages');
        }
      });
    } catch (error) {
      this.logger.error(
        `Failed to create production transporter: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Template management methods
  private loadTemplates(): void {
    try {
      // Create templates directory if it doesn't exist
      if (!fs.existsSync(this.templatesDir)) {
        fs.mkdirSync(this.templatesDir, { recursive: true });
        this.createDefaultTemplates();
      }

      // Load templates from the directory
      const files = fs.readdirSync(this.templatesDir);

      for (const file of files) {
        if (file.endsWith('.hbs')) {
          const templateName = file.replace('.hbs', '');
          const templatePath = path.join(this.templatesDir, file);
          const templateSource = fs.readFileSync(templatePath, 'utf8');

          // Register partials if they exist
          const partialsDir = path.join(this.templatesDir, 'partials');
          if (fs.existsSync(partialsDir)) {
            const partialFiles = fs.readdirSync(partialsDir);
            for (const partialFile of partialFiles) {
              if (partialFile.endsWith('.hbs')) {
                const partialName = partialFile.replace('.hbs', '');
                const partialPath = path.join(partialsDir, partialFile);
                const partialSource = fs.readFileSync(partialPath, 'utf8');
                Handlebars.registerPartial(partialName, partialSource);
              }
            }
          }

          this.templates.set(templateName, Handlebars.compile(templateSource));
          this.logger.log(`Loaded email template: ${templateName}`);
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to load email templates: ${error.message}`,
        error.stack,
      );
    }
  }

  async sendBulkEmails(
    recipients: Array<{
      email: string;
      name?: string;
      context?: Record<string, any>;
    }>,
    subject: string,
    template: string,
    context?: Record<string, any>,
    options?: any,
  ): Promise<{ batchId: string; queued: number }> {
    // Tạo batchId
    const batchId = options?.batchId || uuidv4();
    let queued = 0;

    // Gửi email đến từng người nhận
    for (const recipient of recipients) {
      try {
        // Kết hợp context chung và context riêng của người nhận
        const mergedContext = {
          ...context,
          ...recipient.context,
          name: recipient.name,
          batchId: batchId, // Thêm batchId vào context thay vì truyền như một tham số riêng biệt
        };

        // Chỉ truyền 4 tham số cho queueEmail
        await this.queueEmail(
          recipient.email,
          subject,
          template,
          mergedContext,
        );

        queued++;
      } catch (error) {
        this.logger.error(
          `Failed to queue email for ${recipient.email}: ${error.message}`,
        );
      }
    }

    return { batchId, queued };
  }

  async resendEmail(emailId: string): Promise<string> {
    // Tìm email từ cache hoặc cơ sở dữ liệu
    const emailJob = this.emailJobs.get(emailId);

    if (!emailJob) {
      throw new Error(`Email with ID ${emailId} not found`);
    }

    // Tạo email mới với cùng thông tin
    return this.queueEmail(
      emailJob.to,
      emailJob.subject,
      emailJob.template,
      emailJob.context,
    );
  }

  // Implémentation des méthodes manquantes pour satisfaire l'interface IEmailService
  async getTemplates(filters?: {
    isActive?: boolean;
    category?: string;
    search?: string;
  }): Promise<EmailTemplate[]> {
    try {
      const where: any = {};

      if (filters?.isActive !== undefined) {
        where.isActive = filters.isActive;
      }

      if (filters?.category) {
        where.category = filters.category;
      }

      if (filters?.search) {
        where.name = Like(`%${filters.search}%`);
      }

      return await this.templateRepository.find({
        where,
        order: { updatedAt: 'DESC' },
      });
    } catch (error) {
      this.logger.error(
        `Failed to get templates: ${error.message}`,
        error.stack,
      );
      return [];
    }
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
    try {
      // Validate template syntax
      try {
        Handlebars.compile(content);
      } catch (error) {
        throw new Error(`Invalid template syntax: ${error.message}`);
      }

      // Check if template exists
      let template = await this.templateRepository.findOne({ where: { name } });

      if (template) {
        // Update existing template
        template.content = content;
        if (data?.subject !== undefined) template.subject = data.subject;
        if (data?.description !== undefined)
          template.description = data.description;
        if (data?.isActive !== undefined) template.isActive = data.isActive;
        if (data?.lastEditor !== undefined)
          template.lastEditor = data.lastEditor;
        if (data?.previewText !== undefined)
          template.previewText = data.previewText;
        if (data?.category !== undefined) template.category = data.category;

        // Increment version
        template.version = (template.version || 0) + 1;
      } else {
        // Create new template
        template = this.templateRepository.create({
          name,
          content,
          subject: data?.subject,
          description: data?.description,
          isActive: data?.isActive !== undefined ? data.isActive : true,
          version: data?.version || 1,
          lastEditor: data?.lastEditor,
          previewText: data?.previewText,
          category: data?.category,
        });
      }

      const savedTemplate = await this.templateRepository.save(template);

      // Update template in memory cache
      this.templates.set(name, Handlebars.compile(content));

      return savedTemplate;
    } catch (error) {
      this.logger.error(
        `Failed to save template: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private getTemplate(name: string): HandlebarsTemplateDelegate | undefined {
    // Check if template exists
    if (!this.templates.has(name)) {
      // Create default template if it doesn't exist
      this.createDefaultTemplate(name);
    }

    return this.templates.get(name);
  }

  private createDefaultTemplates(): void {
    // Create basic templates if they don't exist
    this.createDefaultTemplate('verification');
    this.createDefaultTemplate('password-reset');
    this.createDefaultTemplate('welcome');
    this.createDefaultTemplate('2fa-backup-codes');
    this.createDefaultTemplate('login-notification');
    this.createDefaultTemplate('login-attempt');

    // Create partials directory and common partials
    const partialsDir = path.join(this.templatesDir, 'partials');
    if (!fs.existsSync(partialsDir)) {
      fs.mkdirSync(partialsDir, { recursive: true });

      // Create header partial
      fs.writeFileSync(
        path.join(partialsDir, 'header.hbs'),
        `<header style="background-color: #f8f9fa; padding: 20px; text-align: center; border-bottom: 1px solid #e9ecef;">
  <h2>{{appName}}</h2>
</header>`,
      );

      // Create footer partial
      fs.writeFileSync(
        path.join(partialsDir, 'footer.hbs'),
        `<footer style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; text-align: center; color: #6c757d; font-size: 0.9em;">
  <p>© {{currentYear}} {{appName}}. All rights reserved.</p>
  <p>This email was sent to {{recipient}}. If you have any questions, please contact us.</p>
</footer>`,
      );

      // Register helpers
      Handlebars.registerHelper('currentYear', () => new Date().getFullYear());
    }
  }

  private createDefaultTemplate(name: string): void {
    try {
      const templatePath = path.join(this.templatesDir, `${name}.hbs`);

      // Skip if template already exists
      if (fs.existsSync(templatePath)) {
        return;
      }

      // Create directory if it doesn't exist
      if (!fs.existsSync(this.templatesDir)) {
        fs.mkdirSync(this.templatesDir, { recursive: true });
      }

      // Get default template content
      const content = this.getDefaultTemplateContent(name);

      // Write template file
      fs.writeFileSync(templatePath, content);

      // Compile and add to templates map
      this.templates.set(name, Handlebars.compile(content));

      this.logger.log(`Created default email template: ${name}`);
    } catch (error) {
      this.logger.error(
        `Failed to create default template '${name}': ${error.message}`,
        error.stack,
      );
    }
  }

  private getDefaultTemplateContent(name: string): string {
    // Default template content based on template name
    switch (name) {
      case 'verification':
        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Verify your email</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    /* Responsive styles */
    @media only screen and (max-width: 600px) {
      .container {
        width: 100% !important;
      }
      .button {
        width: 100% !important;
      }
    }
  </style>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
  {{> header}}
  <div class="container" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2>Verify your email for {{appName}}</h2>
    <p>Hello {{name}},</p>
    <p>Thank you for signing up! Please verify your email address by clicking the button below:</p>
    <p style="text-align: center;">
      <a href="{{verificationUrl}}" class="button" style="display: inline-block; background-color: #4CAF50; color: white; text-decoration: none; padding: 12px 24px; border-radius: 5px; font-weight: bold;">Verify Email</a>
    </p>
    <p>Or copy and paste this link into your browser:</p>
    <p><a href="{{verificationUrl}}">{{verificationUrl}}</a></p>
    <p>If you did not create an account, please ignore this email.</p>
    <p>Thanks,<br>The {{appName}} Team</p>
  </div>
  {{> footer recipient=to}}
  
  <!-- Tracking pixel for email opens -->
  <img src="{{appUrl}}/api/email-tracker/{{id}}/open" alt="" width="1" height="1" style="display:none;">
</body>
</html>`;

      // Other template cases...
      default:
        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>{{appName}} Notification</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
  {{> header}}
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2>Notification from {{appName}}</h2>
    <p>Hello {{name}},</p>
    <p>This is a notification from {{appName}}.</p>
    <p>Thanks,<br>The {{appName}} Team</p>
  </div>
  {{> footer recipient=to}}
  
  <!-- Tracking pixel for email opens -->
  <img src="{{appUrl}}/api/email-tracker/{{id}}/open" alt="" width="1" height="1" style="display:none;">
</body>
</html>`;
    }
  }

  async sendMagicLinkEmail(
    email: string,
    name: string,
    token: string,
  ): Promise<void> {
    this.logger.log(`
      [Email] Magic Link Email
      To: ${email}
      Name: ${name || 'User'}
      Token: ${token}
    `);
  }

  async sendVerificationCode(
    email: string,
    name: string,
    code: string,
  ): Promise<string> {
    this.logger.log(`
      [VerificationCode Sent]
      To: ${email}
      Name: ${name || 'User'}
      Code: ${code}
    `);
    return 'VerificationCode sent successfully!';
  }
}
