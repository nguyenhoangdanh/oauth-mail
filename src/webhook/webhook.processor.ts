// src/webhook/webhook.processor.ts
import { Process, Processor, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { WebhookService } from './webhook.service';
import { WebhookDeliveryLog } from './entities/webhook-delivery-log.entity';
import { Job } from 'bull';

interface WebhookDeliveryJob {
  webhookId: string;
  event: string;
  payload: any;
  attempt: number;
}

@Processor('webhook-queue')
export class WebhookProcessor {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(
    private readonly webhookService: WebhookService,
    @InjectRepository(WebhookSubscription)
    private readonly webhookRepository: Repository<WebhookSubscription>,
    @InjectRepository(WebhookDeliveryLog)
    private readonly deliveryLogRepository: Repository<WebhookDeliveryLog>,
  ) {}

  @Process('deliver-webhook')
  async handleDeliverWebhook(job: Job<WebhookDeliveryJob>) {
    const { webhookId, event, payload, attempt } = job.data;
    
    this.logger.log(`Processing webhook delivery for ${webhookId} - attempt ${attempt}`);
    
    try {
      // Get the webhook
      const webhook = await this.webhookRepository.findOne({ 
        where: { id: webhookId } 
      });
      
      if (!webhook) {
        throw new Error(`Webhook ${webhookId} not found`);
      }
      
      if (!webhook.isActive) {
        throw new Error(`Webhook ${webhookId} is inactive`);
      }
      
      // Create a delivery log
      const deliveryLog = this.deliveryLogRepository.create({
        webhookId,
        event,
        payload,
        attempt,
        status: 'pending',
      });
      
      await this.deliveryLogRepository.save(deliveryLog);
      
      // Send the webhook
      const startTime = Date.now();
      const result = await this.webhookService.sendWebhook(webhook, payload);
      const duration = Date.now() - startTime;
      
      // Update delivery log
      deliveryLog.status = result.success ? 'success' : 'failed';
      deliveryLog.statusCode = result.statusCode;
      deliveryLog.response = result.response;
      deliveryLog.duration = duration;
      deliveryLog.completedAt = new Date();
      
      if (!result.success) {
        deliveryLog.error = result.response;
      }
      
      await this.deliveryLogRepository.save(deliveryLog);
      
      // Return result
      return {
        success: result.success,
        webhookId,
        event,
        duration,
        status: result.statusCode,
      };
    } catch (error) {
      // Log error and update delivery log if it exists
      this.logger.error(`Webhook delivery failed: ${error.message}`, error.stack);
      
      try {
        const deliveryLog = await this.deliveryLogRepository.findOne({
          where: {
            webhookId,
            event,
            attempt,
          },
          order: { createdAt: 'DESC' },
        });
        
        if (deliveryLog) {
          deliveryLog.status = 'failed';
          deliveryLog.error = error.message;
          deliveryLog.completedAt = new Date();
          await this.deliveryLogRepository.save(deliveryLog);
        }
      } catch (logError) {
        this.logger.error(`Failed to update delivery log: ${logError.message}`);
      }
      
      throw error;
    }
  }
  
  @OnQueueCompleted()
  async onCompleted(job: Job<WebhookDeliveryJob>, result: any) {
    this.logger.log(`Webhook delivery job ${job.id} completed: ${JSON.stringify(result)}`);
  }
  
  @OnQueueFailed()
  async onFailed(job: Job<WebhookDeliveryJob>, error: Error) {
    const { webhookId, event, payload, attempt } = job.data;
    this.logger.error(`Webhook delivery job ${job.id} failed: ${error.message}`);
    
    // If max retries not reached, requeue with increased attempt count
    const webhook = await this.webhookRepository.findOne({ where: { id: webhookId } });
    
    if (webhook && webhook.isActive && attempt < webhook.maxRetries) {
      try {
        // Add exponential delay based on attempt number
        const delay = Math.min(Math.pow(2, attempt) * 5000, 30 * 60 * 1000); // Max 30 minutes
        
        await job.queue.add('deliver-webhook', {
          webhookId,
          event,
          payload,
          attempt: attempt + 1,
        }, { 
          delay,
          attempts: 1, 
          removeOnComplete: true 
        });
        
        this.logger.log(`Requeued webhook ${webhookId} with attempt ${attempt + 1} after delay of ${delay}ms`);
      } catch (requeueError) {
        this.logger.error(`Failed to requeue webhook: ${requeueError.message}`);
      }
    } else if (webhook) {
      // Update webhook with failure info
      webhook.failedAttempts += 1;
      webhook.lastFailure = new Date();
      webhook.lastErrorMessage = error.message;
      
      // If too many failures, disable the webhook
      if (webhook.failedAttempts >= 10) {
        webhook.isActive = false;
        this.logger.warn(`Webhook ${webhookId} disabled after too many failures`);
      }
      
      await this.webhookRepository.save(webhook);
    }
  }
}