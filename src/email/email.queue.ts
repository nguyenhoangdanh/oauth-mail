// src/email/email.queue.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Inject } from '@nestjs/common';
import { EmailService } from './email.service';
import { EMAIL_SERVICE } from './email.di-token';

@Processor('email')
export class EmailQueue extends WorkerHost {
  private readonly logger = new Logger(EmailQueue.name);
  // Tạo một biến toàn cục để theo dõi số lượng email đã gửi trong mỗi khoảng thời gian
  private emailsSentInLastHour = 0;
  private lastResetTime = Date.now();
  private maxEmailsPerHour = 100; // Bắt đầu với giới hạn thấp
  constructor(
    @Inject(EMAIL_SERVICE)
    private emailService: EmailService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<void> {
    const currentTime = Date.now();

    // Reset bộ đếm mỗi giờ
    if (currentTime - this.lastResetTime > 3600000) {
      this.lastResetTime = currentTime;
      // Tăng dần giới hạn theo thời gian (warming up)
      this.maxEmailsPerHour = Math.min(this.maxEmailsPerHour + 50, 500);
      this.emailsSentInLastHour = 0;
    }

    // Kiểm tra giới hạn gửi
    if (this.emailsSentInLastHour >= this.maxEmailsPerHour) {
      // Trì hoãn công việc
      const delay = Math.floor(Math.random() * 1800000) + 1800000; // 30-60 phút
      await job.moveToDelayed(Date.now() + delay);
      return;
    }

    this.logger.debug(`Processing email job ${job.id} for ${job.data.to}`);

    try {
      await this.emailService.processQueuedEmail(job.data);
      this.emailsSentInLastHour++;
      this.logger.debug(`Email job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(
        `Error processing email job ${job.id}: ${error.message}`,
        error.stack,
      );

      // Rethrow to trigger BullMQ's retry mechanism
      throw error;
    }
  }

  // async process(job: Job<any>): Promise<void> {
  //   this.logger.debug(`Processing email job ${job.id} for ${job.data.to}`);

  //   try {
  //     await this.emailService.processQueuedEmail(job.data);
  //     this.logger.debug(`Email job ${job.id} completed successfully`);
  //   } catch (error) {
  //     this.logger.error(
  //       `Error processing email job ${job.id}: ${error.message}`,
  //       error.stack,
  //     );

  //     // Rethrow to trigger BullMQ's retry mechanism
  //     throw error;
  //   }
  // }
}
