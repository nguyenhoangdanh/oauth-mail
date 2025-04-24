// src/email/email.processor.ts
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { NodemailerService } from './nodemailer.service';
import { EmailJob } from './interfaces/email-job.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailLog } from './entities/email-log.entity';

@Processor('email-queue')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly emailService: NodemailerService,
    @InjectRepository(EmailLog)
    private readonly emailLogRepository: Repository<EmailLog>,
  ) {}

  @Process('send-email')
  async handleSendEmail(job: Job<EmailJob>) {
    this.logger.log(
      `Processing email job ${job.id} - attempt ${job.attemptsMade + 1}`,
    );

    try {
      // Update job status
      await this.updateEmailStatus(job.data.id, 'processing', {
        attempts: job.attemptsMade + 1,
      });

      // Process email through Nodemailer service
      await this.emailService.sendEmail(job.data);

      // Update job status to sent
      await this.updateEmailStatus(job.data.id, 'sent', {
        sentAt: new Date(),
      });

      this.logger.log(`Email job ${job.id} completed successfully`);
      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to process email job ${job.id}: ${error.message}`,
        error.stack,
      );

      // Update job status if max retries reached
      if (job.attemptsMade >= job.opts.attempts - 1) {
        await this.updateEmailStatus(job.data.id, 'failed', {
          error: error.message,
        });
      }

      throw error;
    }
  }

  @Process('send-campaign')
  async handleSendCampaign(job: Job<any>) {
    this.logger.log(`Processing campaign job ${job.id}`);

    try {
      const { campaignId, recipientBatch, templateId, subject, sender } =
        job.data;

      // Log campaign batch started
      this.logger.log(
        `Sending batch of ${recipientBatch.length} emails for campaign ${campaignId}`,
      );

      // Process each recipient in the batch
      const promises = recipientBatch.map(async (recipient) => {
        try {
          // Create individual email job
          const emailId = await this.emailService.queueEmail({
            to: recipient.email,
            subject,
            template: templateId,
            context: {
              ...recipient.context,
              campaignId,
              recipientId: recipient.id,
            },
            campaignId,
          });

          return { success: true, recipientId: recipient.id, emailId };
        } catch (error) {
          this.logger.error(
            `Failed to queue email for recipient ${recipient.id}: ${error.message}`,
          );
          return {
            success: false,
            recipientId: recipient.id,
            error: error.message,
          };
        }
      });

      const results = await Promise.all(promises);

      // Log batch results
      const successful = results.filter((r) => r.success).length;
      this.logger.log(
        `Campaign ${campaignId} batch completed: ${successful}/${recipientBatch.length} emails queued`,
      );

      return {
        success: true,
        processed: recipientBatch.length,
        successful,
        failed: recipientBatch.length - successful,
        results,
      };
    } catch (error) {
      console.log('error');
    }
  }
}
