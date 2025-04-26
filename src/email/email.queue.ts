// src/email/email.queue.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Inject } from '@nestjs/common';
import { EmailService } from './email.service';
import { EMAIL_SERVICE } from './email.di-token';

@Processor('email')
export class EmailQueue extends WorkerHost {
  private readonly logger = new Logger(EmailQueue.name);

  constructor(
    @Inject(EMAIL_SERVICE)
    private emailService: EmailService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<void> {
    this.logger.debug(`Processing email job ${job.id} for ${job.data.to}`);

    try {
      await this.emailService.processQueuedEmail(job.data);
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
}
