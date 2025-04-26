import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookEvent } from './nodemailer.service';
import { EmailEvent, EmailEventType } from './entities/email-event.entity';
import { EmailLog, EmailStatus } from './entities/email-log.entity';

@Injectable()
export class EmailEventListener {
  private readonly logger = new Logger(EmailEventListener.name);

  constructor(
    @InjectRepository(EmailEvent)
    private readonly emailEventRepository: Repository<EmailEvent>,
    @InjectRepository(EmailLog)
    private readonly emailLogRepository: Repository<EmailLog>,
  ) {}

  @OnEvent('email.sent')
  async handleEmailSent(payload: WebhookEvent) {
    this.logger.log(
      `Email sent event: ${payload.emailId} to ${payload.recipient}`,
    );

    await this.saveEmailEvent(payload);

    // Cập nhật trạng thái email trong log
    await this.updateEmailLog(payload.emailId, EmailStatus.SENT);
  }

  @OnEvent('email.delivered')
  async handleEmailDelivered(payload: WebhookEvent) {
    this.logger.log(`Email delivered event: ${payload.emailId}`);

    await this.saveEmailEvent(payload);

    // Cập nhật trạng thái email trong log
    await this.updateEmailLog(payload.emailId, EmailStatus.DELIVERED);
  }

  @OnEvent('email.opened')
  async handleEmailOpened(payload: WebhookEvent) {
    this.logger.log(`Email opened event: ${payload.emailId}`);

    await this.saveEmailEvent(payload);

    // Cập nhật trạng thái email trong log
    await this.updateEmailLog(payload.emailId, EmailStatus.OPENED, {
      openedAt: payload.timestamp,
    });
  }

  @OnEvent('email.clicked')
  async handleEmailClicked(payload: WebhookEvent) {
    this.logger.log(
      `Email clicked event: ${payload.emailId}, URL: ${payload.metadata?.url}`,
    );

    await this.saveEmailEvent(payload);

    // Cập nhật trạng thái email trong log
    await this.updateEmailLog(payload.emailId, EmailStatus.CLICKED, {
      clickedAt: payload.timestamp,
      clickUrl: payload.metadata?.url,
    });
  }

  @OnEvent('email.bounced')
  async handleEmailBounced(payload: WebhookEvent) {
    this.logger.log(`Email bounced event: ${payload.emailId}`);

    await this.saveEmailEvent(payload);

    // Cập nhật trạng thái email trong log
    await this.updateEmailLog(payload.emailId, EmailStatus.BOUNCED, {
      bounceReason: payload.metadata?.reason || 'Unknown',
    });
  }

  @OnEvent('email.complained')
  async handleEmailComplained(payload: WebhookEvent) {
    this.logger.log(`Email complained event: ${payload.emailId}`);

    await this.saveEmailEvent(payload);

    // Cập nhật trạng thái email trong log
    await this.updateEmailLog(payload.emailId, EmailStatus.COMPLAINED);
  }

  @OnEvent('email.failed')
  async handleEmailFailed(payload: WebhookEvent) {
    this.logger.log(`Email failed event: ${payload.emailId}`);

    await this.saveEmailEvent(payload);

    // Cập nhật trạng thái email trong log
    await this.updateEmailLog(payload.emailId, EmailStatus.FAILED, {
      error: payload.metadata?.error || 'Unknown error',
    });
  }

  private async saveEmailEvent(event: WebhookEvent): Promise<void> {
    try {
      const emailEvent = new EmailEvent();
      emailEvent.emailId = event.emailId;
      emailEvent.event = event.event as EmailEventType;
      emailEvent.recipient = event.recipient;
      emailEvent.timestamp = event.timestamp;
      emailEvent.metadata = event.metadata || {};

      await this.emailEventRepository.save(emailEvent);
    } catch (error) {
      this.logger.error(
        `Failed to save email event: ${error.message}`,
        error.stack,
      );
    }
  }

  private async updateEmailLog(
    emailId: string,
    status: EmailStatus,
    additionalData: Record<string, any> = {},
  ): Promise<void> {
    try {
      const emailLog = await this.emailLogRepository.findOne({
        where: { emailId },
      });

      if (emailLog) {
        emailLog.status = status;

        // Update with additional data
        Object.keys(additionalData).forEach((key) => {
          emailLog[key] = additionalData[key];
        });

        // Update last status change time
        emailLog.lastStatusAt = new Date();

        await this.emailLogRepository.save(emailLog);
      }
    } catch (error) {
      this.logger.error(
        `Failed to update email log: ${error.message}`,
        error.stack,
      );
    }
  }
}
