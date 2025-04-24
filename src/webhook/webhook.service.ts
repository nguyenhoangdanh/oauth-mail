// src/webhook/webhook.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { EmailService } from '../email/email.service';
import { EMAIL_SERVICE } from '../email/email.di-token';
import * as crypto from 'crypto';
import Queue from 'bull';

interface WebhookDeliveryJob {
  webhookId: string;
  event: string;
  payload: any;
  attempt: number;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly webhookSecret: string;

  constructor(
    @InjectRepository(WebhookSubscription)
    private readonly webhookRepository: Repository<WebhookSubscription>,
    @Inject(EMAIL_SERVICE)
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    @InjectQueue('webhook-queue')
    private readonly webhookQueue: Queue<WebhookDeliveryJob>,
  ) {
    this.webhookSecret = this.configService.get<string>('WEBHOOK_SECRET', 'your-webhook-secret');
    this.registerWebhookHandlers();
  }

  private registerWebhookHandlers(): void {
    // Register handlers with the email service for different events
    const events = [
      'sent', 'delivered', 'opened', 'clicked', 
      'bounced', 'complained', 'failed'
    ];
    
    events.forEach(event => {
      this.emailService.registerWebhook(event, async (data) => {
        await this.processWebhookEvent(event, data);
      });
    });
  }

  private async processWebhookEvent(event: string, data: any): Promise<void> {
    try {
      // Find all active webhooks for this event
      const webhooks = await this.webhookRepository.find({
        where: { event, isActive: true }
      });
      
      if (webhooks.length === 0) {
        return;
      }
      
      // Queue delivery for each webhook
      for (const webhook of webhooks) {
        await this.queueWebhookDelivery(webhook.id, event, data);
      }
    } catch (error) {
      this.logger.error(
        `Error processing webhook event ${event}: ${error.message}`,
        error.stack
      );
    }
  }

  private async queueWebhookDelivery(
    webhookId: string, 
    event: string, 
    payload: any
  ): Promise<void> {
    await this.webhookQueue.add(
      'deliver-webhook',
      {
        webhookId,
        event,
        payload,
        attempt: 1,
      },
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
  }

  async findAll(): Promise<WebhookSubscription[]> {
    return this.webhookRepository.find({
      order: { createdAt: 'DESC' }
    });
  }
  
  async findByFilters(filters: Record<string, any>): Promise<WebhookSubscription[]> {
    return this.webhookRepository.find({
      where: filters,
      order: { createdAt: 'DESC' }
    });
  }

  async findOne(id: string): Promise<WebhookSubscription> {
    return this.webhookRepository.findOne({ where: { id } });
  }

  async create(
    createWebhookDto: CreateWebhookDto,
  ): Promise<WebhookSubscription> {
    // Normalize the webhook URL
    const endpoint = this.normalizeUrl(createWebhookDto.endpoint);
    
    // Generate a secret if not provided
    const secret = createWebhookDto.secret || this.generateWebhookSecret();
    
    const webhook = this.webhookRepository.create({
      ...createWebhookDto,
      endpoint,
      secret,
    });
    
    const savedWebhook = await this.webhookRepository.save(webhook);
    
    return savedWebhook;
  }

  async update(
    id: string,
    updateWebhookDto: UpdateWebhookDto,
  ): Promise<WebhookSubscription> {
    // Normalize URL if provided
    if (updateWebhookDto.endpoint) {
      updateWebhookDto.endpoint = this.normalizeUrl(updateWebhookDto.endpoint);
    }
    
    await this.webhookRepository.update(id, updateWebhookDto);
    return this.webhookRepository.findOne({ where: { id } });
  }

  async remove(id: string): Promise<void> {
    await this.webhookRepository.delete(id);
  }

  private normalizeUrl(url: string): string {
    // Ensure URL starts with http:// or https://
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`;
    }
    return url;
  }

  private generateWebhookSecret(): string {
    return crypto.randomBytes(24).toString('hex');
  }

  generateSignature(payload: any, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }

  async sendWebhook(
    webhook: WebhookSubscription,
    data: any,
  ): Promise<{ success: boolean; statusCode?: number; response?: any }> {
    try {
      // Prepare the webhook payload
      const timestamp = new Date().toISOString();
      const payload = {
        ...data,
        timestamp,
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

      // Send the webhook using fetch API
      const response = await fetch(webhook.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const statusCode = response.status;
      const responseData = await response.text();

      // Update webhook stats
      if (response.ok) {
        await this.updateWebhookSuccess(webhook);
      } else {
        throw new Error(`HTTP status ${statusCode}: ${responseData}`);
      }

      return { 
        success: response.ok, 
        statusCode,
        response: responseData
      };
    } catch (error) {
      await this.updateWebhookFailure(webhook, error.message);
      throw error;
    }
  }

  private async updateWebhookSuccess(webhook: WebhookSubscription): Promise<void> {
    webhook.lastSuccess = new Date();
    webhook.failedAttempts = 0;
    await this.webhookRepository.save(webhook);
  }

  private async updateWebhookFailure(webhook: WebhookSubscription, errorMessage: string): Promise<void> {
    webhook.failedAttempts += 1;
    webhook.lastFailure = new Date();
    webhook.lastErrorMessage = errorMessage;
    
    // If too many failures, disable the webhook
    if (webhook.failedAttempts >= 10) {
      webhook.isActive = false;
    }
    
    await this.webhookRepository.save(webhook);
  }

  async testWebhook(
    id: string,
  ): Promise<{ success: boolean; message: string; details?: any }> {
    const webhook = await this.webhookRepository.findOne({ where: { id } });

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const testPayload = {
      id: crypto.randomUUID(),
      event: webhook.event,
      emailId: 'test-email-id',
      recipient: 'test@example.com',
      metadata: { test: true },
    };

    try {
      const result = await this.sendWebhook(webhook, testPayload);
      return {
        success: result.success,
        message: `Test webhook successfully sent to ${webhook.endpoint}`,
        details: {
          statusCode: result.statusCode,
          response: result.response
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to send test webhook: ${error.message}`,
        details: { error: error.message }
      };
    }
  }
  
  async findByEvent(event: string): Promise<WebhookSubscription[]> {
    return this.webhookRepository.find({
      where: { event, isActive: true }
    });
  }
  
  async resetFailureCount(id: string): Promise<WebhookSubscription> {
    const webhook = await this.webhookRepository.findOne({ where: { id } });
    
    if (!webhook) {
      throw new Error('Webhook not found');
    }
    
    webhook.failedAttempts = 0;
    webhook.isActive = true;
    webhook.lastErrorMessage = null;
    
    return this.webhookRepository.save(webhook);
  }
  
  async retryDelivery(deliveryLog: WebhookDeliveryLog): Promise<{ success: boolean; message: string }> {
    try {
      await this.webhookQueue.add(
        'deliver-webhook',
        {
          webhookId: deliveryLog.webhookId,
          event: deliveryLog.event,
          payload: deliveryLog.payload,
          attempt: 1, // Reset attempt counter
        },
        {
          attempts: 1,
          removeOnComplete: true,
        }
      );
      
      return {
        success: true,
        message: 'Webhook delivery retry has been queued',
      };
    } catch (error) {
      this.logger.error(`Failed to retry webhook delivery: ${error.message}`, error.stack);
      return {
        success: false,
        message: `Failed to retry webhook delivery: ${error.message}`,
      };
    }
  }
}