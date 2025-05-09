// src/email/email-template-sync.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { EmailTemplate } from './entities/email-template.entity';

@Injectable()
export class EmailTemplateSyncService implements OnModuleInit {
  private readonly logger = new Logger(EmailTemplateSyncService.name);
  private readonly templateDir: string;

  constructor(
    @InjectRepository(EmailTemplate)
    private emailTemplateRepository: Repository<EmailTemplate>,
    private configService: ConfigService,
  ) {
    this.templateDir = path.join(process.cwd(), 'templates/emails');
  }

  /**
   * Run on module initialization
   */
  async onModuleInit() {
    try {
      this.logger.log('Checking email templates');
      await this.syncEmailTemplates();
      this.logger.log('Email templates synchronized successfully');
    } catch (error) {
      this.logger.error(
        `Failed to sync email templates: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Synchronize email templates from filesystem to database
   */
  async syncEmailTemplates(): Promise<void> {
    try {
      // Check if templates directory exists
      if (!fs.existsSync(this.templateDir)) {
        this.logger.warn(`Template directory not found: ${this.templateDir}`);
        return;
      }

      // Get all template files
      const files = fs.readdirSync(this.templateDir);

      for (const file of files) {
        // Skip directories and non-hbs files
        const filePath = path.join(this.templateDir, file);
        if (fs.statSync(filePath).isDirectory() || !file.endsWith('.hbs')) {
          continue;
        }

        const templateName = file.replace('.hbs', '');

        // Check if template exists in database
        const existingTemplate = await this.emailTemplateRepository.findOne({
          where: { name: templateName },
        });

        if (!existingTemplate) {
          // Create new template in database
          await this.createTemplateFromFile(templateName, filePath);
        } else if (!existingTemplate.isActive) {
          // Activate inactive template and update content
          await this.activateTemplate(existingTemplate, filePath);
        } else if (
          this.configService.get<boolean>(
            'EMAIL_UPDATE_TEMPLATES_ON_START',
            false,
          )
        ) {
          // Optionally update template content if configured
          await this.updateTemplateContent(existingTemplate, filePath);
        }
      }

      // Handle partial templates
      await this.syncPartialTemplates();
    } catch (error) {
      this.logger.error(`Template sync error: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handle partial templates
   */
  private async syncPartialTemplates(): Promise<void> {
    const partialsDir = path.join(this.templateDir, 'partials');

    // Skip if partials directory doesn't exist
    if (!fs.existsSync(partialsDir)) {
      return;
    }

    const files = fs.readdirSync(partialsDir);

    for (const file of files) {
      if (!file.endsWith('.hbs')) {
        continue;
      }

      const partialName = `partial-${file.replace('.hbs', '')}`;
      const filePath = path.join(partialsDir, file);

      // Check if partial exists in database
      const existingPartial = await this.emailTemplateRepository.findOne({
        where: { name: partialName },
      });

      if (!existingPartial) {
        // Create new partial
        const content = fs.readFileSync(filePath, 'utf8');

        const newPartial = this.emailTemplateRepository.create({
          name: partialName,
          content,
          description: `Partial template for ${file.replace('.hbs', '')}`,
          isActive: true,
          version: 1,
          category: 'partial',
        });

        await this.emailTemplateRepository.save(newPartial);
        this.logger.log(`Created partial template: ${partialName}`);
      } else if (!existingPartial.isActive) {
        // Activate inactive partial
        const content = fs.readFileSync(filePath, 'utf8');

        existingPartial.isActive = true;
        existingPartial.content = content;
        existingPartial.version += 1;

        await this.emailTemplateRepository.save(existingPartial);
        this.logger.log(`Activated partial template: ${partialName}`);
      }
    }
  }

  /**
   * Create a new template from file
   */
  private async createTemplateFromFile(
    templateName: string,
    filePath: string,
  ): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf8');
    const metadata = this.getTemplateMetadata(templateName);

    const newTemplate = this.emailTemplateRepository.create({
      name: templateName,
      subject: metadata.subject,
      content: content,
      description: metadata.description,
      isActive: true,
      version: 1,
      category: metadata.category,
    });

    await this.emailTemplateRepository.save(newTemplate);
    this.logger.log(`Created template: ${templateName}`);
  }

  /**
   * Activate an inactive template
   */
  private async activateTemplate(
    template: EmailTemplate,
    filePath: string,
  ): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf8');

    template.isActive = true;
    template.content = content;
    template.version += 1;

    await this.emailTemplateRepository.save(template);
    this.logger.log(`Activated template: ${template.name}`);
  }

  /**
   * Update template content
   */
  private async updateTemplateContent(
    template: EmailTemplate,
    filePath: string,
  ): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf8');

    template.content = content;
    template.version += 1;

    await this.emailTemplateRepository.save(template);
    this.logger.log(`Updated template content: ${template.name}`);
  }

  /**
   * Get template metadata based on name
   */
  private getTemplateMetadata(templateName: string): {
    subject: string;
    description: string;
    category: string;
  } {
    switch (templateName) {
      case 'welcome':
        return {
          subject: 'Chào mừng bạn đến với dịch vụ của chúng tôi',
          description: 'Template chào mừng người dùng mới',
          category: 'onboarding',
        };
      case 'verification':
        return {
          subject: 'Xác thực email của bạn',
          description: 'Template email xác thực',
          category: 'authentication',
        };
      case 'password-reset':
        return {
          subject: 'Yêu cầu đặt lại mật khẩu',
          description: 'Template đặt lại mật khẩu',
          category: 'authentication',
        };
      case 'magic-link':
        return {
          subject: 'Đăng nhập vào tài khoản của bạn',
          description: 'Template magic link đăng nhập',
          category: 'authentication',
        };
      case 'login-notification':
        return {
          subject: 'Thông báo đăng nhập mới',
          description: 'Template thông báo đăng nhập mới',
          category: 'security',
        };
      case 'login-attempt':
        return {
          subject: 'Phát hiện đăng nhập không thành công',
          description: 'Template thông báo đăng nhập không thành công',
          category: 'security',
        };
      case '2fa-backup-codes':
        return {
          subject: 'Mã dự phòng 2FA của bạn',
          description: 'Template mã dự phòng 2FA',
          category: 'security',
        };
      default:
        return {
          subject: `${templateName} notification`,
          description: `Template cho ${templateName}`,
          category: 'notification',
        };
    }
  }
}
