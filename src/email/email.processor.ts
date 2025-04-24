// src/email/email.processor.ts
import { Process, Processor, OnQueueCompleted, OnQueueFailed, OnQueueActive } from '@nestjs/bull';
import { Logger, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { EmailLog } from './entities/email-log.entity';
import { EmailTemplate } from './entities/email-template.entity';
import { EmailJob, BulkEmailJob } from './interfaces/email-job.interface';
import * as nodemailer from 'nodemailer';
import * as Handlebars from 'handlebars';
import { EmailTrackingHelper } from './email.tracking.helper';
import { OAuth2Service } from './oauth2.service';
import { v4 as uuidv4 } from 'uuid';
type Job<T = any> = {
  id: string;
  data: T;
  opts: any;
  attemptsMade: number;
  queue: any;
  name: string;
};

@Injectable()
@Processor('email-queue')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);
  private transporter: nodemailer.Transporter;
  private readonly templates: Map<string, HandlebarsTemplateDelegate<any>> = new Map();
  private readonly fromEmail: string;
  private readonly appName: string;
  private readonly appUrl: string;
  private readonly useOAuth: boolean;

  constructor(
    @InjectRepository(EmailLog)
    private readonly emailLogRepository: Repository<EmailLog>,
    @InjectRepository(EmailTemplate)
    private readonly templateRepository: Repository<EmailTemplate>,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly emailTrackingHelper: EmailTrackingHelper,
    private readonly oauth2Service: OAuth2Service,
  ) {
    this.appName = this.configService.get<string>('APP_NAME', 'SecureMail');
    this.appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
    this.fromEmail = this.configService.get<string>('EMAIL_FROM', `"${this.appName}" <hoangdanh54317@gmail.com>`);
    this.useOAuth = this.configService.get<string>('EMAIL_USE_OAUTH', 'false') === 'true';
    
    // Initialize the transporter and load templates
    this.initializeTransporter().then(() => {
      this.logger.log('Email transporter initialized');
    }).catch(error => {
      this.logger.error(`Failed to initialize email transporter: ${error.message}`, error.stack);
    });
    
    this.loadTemplates().then(() => {
      this.logger.log('Email templates loaded');
    }).catch(error => {
      this.logger.error(`Failed to load email templates: ${error.message}`, error.stack);
    });
    
    // Register Handlebars helpers
    this.registerHandlebarsHelpers();
  }

  private async loadTemplates(): Promise<void> {
    try {
      // Load templates from database
      const templates = await this.templateRepository.find({ where: { isActive: true } });
      
      // Load templates into memory
      for (const template of templates) {
        try {
          this.templates.set(template.name, Handlebars.compile(template.content));
          this.logger.debug(`Loaded email template: ${template.name}`);
        } catch (error) {
          this.logger.error(`Failed to compile template ${template.name}: ${error.message}`);
        }
      }
      
      this.logger.log(`Loaded ${this.templates.size} email templates`);
    } catch (error) {
      this.logger.error(`Failed to load email templates: ${error.message}`, error.stack);
      throw error;
    }
  }

  private registerHandlebarsHelpers(): void {
    // Current year helper
    Handlebars.registerHelper('currentYear', () => new Date().getFullYear());
    
    // Concatenation helper
    Handlebars.registerHelper('concat', (...args) => {
      // Remove the Handlebars options object
      args.pop();
      return args.join('');
    });
    
    // Conditional helper
    Handlebars.registerHelper('ifCond', function(v1, operator, v2, options) {
      switch (operator) {
        case '==':
          return (v1 == v2) ? options.fn(this) : options.inverse(this);
        case '===':
          return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case '!=':
          return (v1 != v2) ? options.fn(this) : options.inverse(this);
        case '!==':
          return (v1 !== v2) ? options.fn(this) : options.inverse(this);
        case '<':
          return (v1 < v2) ? options.fn(this) : options.inverse(this);
        case '<=':
          return (v1 <= v2) ? options.fn(this) : options.inverse(this);
        case '>':
          return (v1 > v2) ? options.fn(this) : options.inverse(this);
        case '>=':
          return (v1 >= v2) ? options.fn(this) : options.inverse(this);
        case '&&':
          return (v1 && v2) ? options.fn(this) : options.inverse(this);
        case '||':
          return (v1 || v2) ? options.fn(this) : options.inverse(this);
        default:
          return options.inverse(this);
      }
    });
    
    // Date formatting helper
    Handlebars.registerHelper('formatDate', function(date, format) {
      if (!date) return '';
      
      const d = new Date(date);
      
      // Simple format implementation
      switch (format) {
        case 'short':
          return d.toLocaleDateString();
        case 'long':
          return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
        case 'time':
          return d.toLocaleTimeString();
        case 'iso':
          return d.toISOString();
        default:
          return d.toString();
      }
    });
    
    // Load partials
    this.loadPartials().catch(error => {
      this.logger.error(`Failed to load partials: ${error.message}`, error.stack);
    });
  }
  
  private async loadPartials(): Promise<void> {
    try {
      const partials = await this.templateRepository.find({
        where: { name: Like('partial-%') },
      });
      
      for (const partial of partials) {
        try {
          const partialName = partial.name.replace('partial-', '');
          Handlebars.registerPartial(partialName, partial.content);
          this.logger.debug(`Registered email template partial: ${partialName}`);
        } catch (error) {
          this.logger.error(`Failed to register partial ${partial.name}: ${error.message}`);
        }
      }
      
      this.logger.log(`Registered ${partials.length} email template partials`);
    } catch (error) {
      this.logger.error(`Failed to load partials: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async initializeTransporter(): Promise<void> {
    try {
      if (this.configService.get<string>('EMAIL_USE_TEST_ACCOUNT', 'false') === 'true') {
        // Create test account for development
        const testAccount = await nodemailer.createTestAccount();
        
        // Fix: Use correct type for transport configuration
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
        } as nodemailer.TransportOptions);
        
        this.logger.log(`Created test email account: ${testAccount.user}`);
        return;
      }
      
      const emailHost = this.configService.get<string>('EMAIL_HOST', 'smtp.gmail.com');
      const emailPort = this.configService.get<number>('EMAIL_PORT', 587);
      const emailUser = this.configService.get<string>('EMAIL_USER', '');
      const emailPass = this.configService.get<string>('EMAIL_PASS', '');
      const emailSecure = this.configService.get<string>('EMAIL_SECURE', 'false') === 'true';
      
      // Fix: Use correct type for transport configuration
      const transportConfig: nodemailer.TransportOptions = {
        // Cast to any to avoid TypeScript errors with host property
        host: emailHost,
        port: emailPort,
        secure: emailSecure,
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
      } as any;
      
      if (this.useOAuth && emailHost.includes('gmail')) {
        // Use OAuth2 for Gmail
        this.logger.log('Using OAuth2 authentication for Gmail');
        
        (transportConfig as any).auth = {
          type: 'OAuth2',
          user: emailUser,
          clientId: this.configService.get<string>('GMAIL_CLIENT_ID'),
          clientSecret: this.configService.get<string>('GMAIL_CLIENT_SECRET'),
          refreshToken: this.configService.get<string>('GMAIL_REFRESH_TOKEN'),
          accessToken: await this.oauth2Service.getGmailAccessToken(),
        };
      } else {
        // Use regular username/password
        (transportConfig as any).auth = {
          user: emailUser,
          pass: emailPass,
        };
      }
      
      this.transporter = nodemailer.createTransport(transportConfig);
      
      // Verify connection
      await this.transporter.verify();
      this.logger.log(`SMTP connection established to ${emailHost}:${emailPort}`);
    } catch (error) {
      this.logger.error(`Failed to create email transporter: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Process('send-email')
  async handleSendEmail(job: Job<EmailJob>): Promise<any> {
    const { id, to, subject, template, context, attempts = 0 } = job.data;
    this.logger.log(`Processing email job ${id} to ${to} - attempt ${attempts + 1}`);
    
    try {
      // Update job status
      await this.updateEmailStatus(id, 'processing', {
        attempts: attempts + 1,
      });
      
      // Get template from cache or database
      let compiledTemplate = this.templates.get(template);
      
      // If template not in cache, try to load from database
      if (!compiledTemplate) {
        await this.reloadTemplate(template);
        compiledTemplate = this.templates.get(template);
        
        if (!compiledTemplate) {
          throw new Error(`Template "${template}" not found`);
        }
      }
      
      // Add standard context variables
      const enhancedContext = {
        ...context,
        appName: this.appName,
        appUrl: this.appUrl,
        emailId: id,
        currentYear: new Date().getFullYear(),
      };
      
      // Render template
      const html = compiledTemplate(enhancedContext);
      
      // Add tracking pixels and link tracking
      const trackedHtml = this.emailTrackingHelper.processHtmlForTracking(html, id);
      
      // Prepare mail options
      const mailOptions = {
        from: this.fromEmail,
        to,
        subject,
        html: trackedHtml,
        text: this.generateTextVersion(html),
        headers: {
          'X-Email-ID': id,
          'X-SecureMail-Track': '1',
        },
      };
      
      // Send email
      const info = await this.transporter.sendMail(mailOptions);
      
      // Update job status
      await this.updateEmailStatus(id, 'sent', {
        sentAt: new Date(),
        messageId: info.messageId,
      });
      
      // Emit event
      this.eventEmitter.emit('email.sent', {
        id: uuidv4(),
        event: 'sent',
        emailId: id,
        recipient: to,
        timestamp: new Date(),
        metadata: { messageId: info.messageId },
      });
      
      // Log test email URL if using test account
      if (this.configService.get<string>('EMAIL_USE_TEST_ACCOUNT', 'false') === 'true') {
        this.logger.log(`Test email URL: ${nodemailer.getTestMessageUrl(info)}`);
      }
      
      this.logger.log(`Email ${id} sent successfully to ${to}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      this.logger.error(`Failed to send email ${id}: ${error.message}`, error.stack);
      
      // Update status if max retries reached
      if (job.attemptsMade >= (job.opts?.attempts || 1) - 1) {
        await this.updateEmailStatus(id, 'failed', {
          error: error.message,
        });
        
        // Emit failed event
        this.eventEmitter.emit('email.failed', {
          id: uuidv4(),
          event: 'failed',
          emailId: id,
          recipient: to,
          timestamp: new Date(),
          metadata: { error: error.message },
        });
      }
      
      throw error;
    }
  }

  @Process('send-bulk')
  async handleBulkSend(job: Job<BulkEmailJob>): Promise<any> {
    const { batchId, recipients, template, subject, context, campaignId, tags, userId } = job.data;
    this.logger.log(`Processing bulk email job ${batchId} with ${recipients.length} recipients`);
    
    const results = {
      total: recipients.length,
      successful: 0,
      failed: 0,
      details: [],
    };
    
    // Process each recipient
    for (const recipient of recipients) {
      try {
        // Create individual email job with tracking ID
        const emailId = uuidv4();
        
        // Create email log entry
        await this.emailLogRepository.save({
          emailId,
          to: recipient.email,
          name: recipient.name,
          subject,
          template,
          context: {
            ...context,
            ...recipient.context,
            batchId,
          },
          status: 'pending',
          batchId,
          campaignId,
          tags,
          userId
        });
        
        // Add to queue
        await job.queue.add('send-email', {
          id: emailId,
          to: recipient.email,
          subject,
          template,
          context: {
            ...context,
            ...recipient.context,
            name: recipient.name,
            batchId,
            campaignId,
          },
          batchId,
          campaignId,
        });
        
        results.successful++;
        results.details.push({
          email: recipient.email,
          status: 'queued',
          emailId,
        });
      } catch (error) {
        results.failed++;
        results.details.push({
          email: recipient.email,
          status: 'failed',
          error: error.message,
        });
        this.logger.error(`Failed to queue email for ${recipient.email}: ${error.message}`);
      }
    }
    
    this.logger.log(`Completed bulk email job ${batchId}: ${results.successful} queued, ${results.failed} failed`);
    return results;
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.debug(`Job ${job.id} completed with result: ${JSON.stringify(result)}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed with error: ${error.message}`, error.stack);
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.debug(`Processing job ${job.id} of type ${job.name}`);
  }

  private async updateEmailStatus(
    emailId: string,
    status: string,
    updates: Partial<EmailLog> = {},
  ): Promise<void> {
    try {
      await this.emailLogRepository.update(
        { emailId },
        {
          status,
          lastStatusAt: new Date(),
          ...updates,
        },
      );
    } catch (error) {
      this.logger.error(`Failed to update email status: ${error.message}`, error.stack);
    }
  }

  private async reloadTemplate(templateName: string): Promise<void> {
    try {
      const template = await this.templateRepository.findOne({
        where: { name: templateName },
      });
      
      if (template) {
        this.templates.set(template.name, Handlebars.compile(template.content));
        this.logger.log(`Reloaded template: ${template.name}`);
      }
    } catch (error) {
      this.logger.error(`Failed to reload template: ${error.message}`, error.stack);
    }
  }

  private generateTextVersion(html: string): string {
    // Basic HTML to text conversion
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style[^>]*>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script[^>]*>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}