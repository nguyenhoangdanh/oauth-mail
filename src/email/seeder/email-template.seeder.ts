// src/email/email-template.seeder.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { EmailTemplate } from '../entities/email-template.entity';

@Injectable()
export class EmailTemplateSeeder implements OnModuleInit {
  private readonly logger = new Logger(EmailTemplateSeeder.name);
  private readonly templatesDir = path.join(process.cwd(), 'templates/emails');

  constructor(
    @InjectRepository(EmailTemplate)
    private readonly templateRepository: Repository<EmailTemplate>,
  ) {}

  async onModuleInit() {
    await this.seedDefaultTemplates();
  }

  async seedDefaultTemplates() {
    try {
      // Kiểm tra xem đã có templates nào trong database chưa
      const count = await this.templateRepository.count();

      if (count > 0) {
        this.logger.log('Templates đã tồn tại trong database, bỏ qua seeding');
        return;
      }

      this.logger.log('Bắt đầu seed templates từ thư mục vào database...');

      const templateFiles = fs.readdirSync(this.templatesDir);

      for (const file of templateFiles) {
        // Chỉ xử lý các file .hbs
        if (
          file.endsWith('.hbs') &&
          !fs.lstatSync(path.join(this.templatesDir, file)).isDirectory()
        ) {
          const templateName = file.replace('.hbs', '');
          const templatePath = path.join(this.templatesDir, file);
          const content = fs.readFileSync(templatePath, 'utf8');

          // Tạo template trong database
          await this.templateRepository.save({
            name: templateName,
            content,
            subject: this.getDefaultSubject(templateName),
            description: `Template ${templateName}`,
            isActive: true,
            version: 1,
          });

          this.logger.log(`Đã seed template: ${templateName}`);
        }
      }

      // Xử lý các partials nếu cần
      const partialsDir = path.join(this.templatesDir, 'partials');

      if (fs.existsSync(partialsDir)) {
        const partialFiles = fs.readdirSync(partialsDir);

        for (const file of partialFiles) {
          if (file.endsWith('.hbs')) {
            const partialName = `partial-${file.replace('.hbs', '')}`;
            const partialPath = path.join(partialsDir, file);
            const content = fs.readFileSync(partialPath, 'utf8');

            await this.templateRepository.save({
              name: partialName,
              content,
              description: `Partial template ${partialName}`,
              isActive: true,
              version: 1,
              category: 'partial',
            });

            this.logger.log(`Đã seed partial: ${partialName}`);
          }
        }
      }

      this.logger.log('Seed templates hoàn tất');
    } catch (error) {
      this.logger.error(
        `Lỗi khi seed templates: ${error.message}`,
        error.stack,
      );
    }
  }

  private getDefaultSubject(templateName: string): string {
    // Đặt tiêu đề mặc định dựa vào tên template
    switch (templateName) {
      case 'welcome':
        return 'Chào mừng bạn đến với dịch vụ của chúng tôi';
      case 'verification':
        return 'Xác thực email của bạn';
      case 'password-reset':
        return 'Yêu cầu đặt lại mật khẩu';
      case '2fa-backup-codes':
        return 'Mã dự phòng 2FA của bạn';
      case 'login-notification':
        return 'Thông báo đăng nhập mới';
      case 'login-attempt':
        return 'Phát hiện đăng nhập không thành công';
      default:
        return `Template ${templateName}`;
    }
  }
}
