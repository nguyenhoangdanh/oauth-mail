// src/webhook/webhook.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { Inject } from '@nestjs/common';
import { EMAIL_SERVICE } from '../email/email.di-token';
import { NodemailerService } from '../email/nodemailer.service';
import * as crypto from 'crypto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(WebhookSubscription)
    private readonly webhookRepository: Repository<WebhookSubscription>,
    @Inject(EMAIL_SERVICE)
    private readonly emailService: NodemailerService,
  ) {}

  async findAll(): Promise<WebhookSubscription[]> {
    return this.webhookRepository.find();
  }

  async findOne(id: string): Promise<WebhookSubscription> {
    return this.webhookRepository.findOne({ where: { id } });
  }

  async create(
    createWebhookDto: CreateWebhookDto,
  ): Promise<WebhookSubscription> {
    const webhook = this.webhookRepository.create(createWebhookDto);
    const savedWebhook = await this.webhookRepository.save(webhook);

    // Register the webhook handler
    this.registerWebhookHandler(savedWebhook);

    return savedWebhook;
  }

  async update(
    id: string,
    updateWebhookDto: UpdateWebhookDto,
  ): Promise<WebhookSubscription> {
    await this.webhookRepository.update(id, updateWebhookDto);
    const updatedWebhook = await this.webhookRepository.findOne({
      where: { id },
    });

    // Re-register the webhook handler
    this.registerWebhookHandler(updatedWebhook);

    return updatedWebhook;
  }

  async remove(id: string): Promise<void> {
    await this.webhookRepository.delete(id);
  }

  private registerWebhookHandler(webhook: WebhookSubscription): void {
    // Register with the email service
    this.emailService.registerWebhook(webhook.event, async (data) => {
      if (!webhook.isActive) return;

      try {
        await this.sendWebhook(webhook, data);

        // Update last success
        webhook.lastSuccess = new Date();
        webhook.failedAttempts = 0;
        await this.webhookRepository.save(webhook);
      } catch (error) {
        this.logger.error(
          `Failed to send webhook ${webhook.id} to ${webhook.endpoint}: ${error.message}`,
          error.stack,
        );

        // Update failure stats
        webhook.failedAttempts += 1;
        webhook.lastFailure = new Date();
        await this.webhookRepository.save(webhook);

        // Implement retry logic if needed
      }
    });
  }

  private async sendWebhook(
    webhook: WebhookSubscription,
    data: any,
  ): Promise<void> {
    // Prepare the webhook payload
    const payload = {
      ...data,
      timestamp: new Date().toISOString(),
    };

    // Generate signature for verification
    const signature = this.generateSignature(payload, webhook.secret);

    // Default headers
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'SecureMail-Webhook/1.0',
      'X-SecureMail-Event': data.event,
      'X-SecureMail-Delivery': Date.now().toString(),
      'X-SecureMail-Signature': signature,
      ...webhook.headers,
    };

    // Send the webhook using native fetch API instead of axios
    const response = await fetch(webhook.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Webhook request failed with status ${response.status}: ${errorText}`,
      );
    }
  }

  private generateSignature(payload: any, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }

  async testWebhook(
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    const webhook = await this.webhookRepository.findOne({ where: { id } });

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const testPayload = {
      id: crypto.randomUUID(),
      event: webhook.event,
      emailId: 'test-email-id',
      recipient: 'test@example.com',
      timestamp: new Date(),
      metadata: { test: true },
    };

    try {
      await this.sendWebhook(webhook, testPayload);
      return {
        success: true,
        message: `Test webhook successfully sent to ${webhook.endpoint}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to send test webhook: ${error.message}`,
      };
    }
  }
}
