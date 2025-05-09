// src/webhook/webhook.service.ts
import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { WebhookDeliveryLog } from './entities/webhook-delivery-log.entity';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { EVENT_EMITTER_TOKEN } from '../common/events/event-emitter.di-token';
import { EventEmitter } from 'events';

@Injectable()
export class WebhookService implements OnModuleInit {
  private readonly logger = new Logger(WebhookService.name);
  private readonly supportedEvents = [
    'email.sent',
    'email.delivered',
    'email.opened',
    'email.clicked',
    'email.bounced',
    'email.complained',
    'email.failed',
    'user.created',
    'user.updated',
    'user.deleted',
    'user.login',
    'user.logout',
  ];

  private readonly authEvents = [
    'user.created',
    'user.updated',
    'user.deleted',
    'user.login',
    'user.logout',
    'user.password_changed',
    'user.email_verified',
    'user.two_factor_enabled',
    'user.two_factor_disabled',
    'session.created',
    'session.revoked',
    'organization.created',
    'organization.updated',
    'organization.deleted',
    'organization.member_added',
    'organization.member_removed',
    'organization.member_role_changed',
  ];

  constructor(
    @InjectRepository(WebhookSubscription)
    private webhookRepository: Repository<WebhookSubscription>,
    @InjectRepository(WebhookDeliveryLog)
    private deliveryLogRepository: Repository<WebhookDeliveryLog>,
    @InjectQueue('webhook')
    private webhookQueue: Queue,
    private configService: ConfigService,
    @Inject(EVENT_EMITTER_TOKEN)
    private eventEmitter: EventEmitter,
  ) {}

  onModuleInit() {
    // Register event listeners when module initializes
    this.registerEventListeners();
  }

  private registerEventListeners() {
    // Register listeners for all supported events
    this.supportedEvents.forEach((eventName) => {
      this.eventEmitter.on(eventName, async (data: any) => {
        await this.processEvent(eventName, data);
      });
    });

    this.logger.log(
      `Registered event listeners for ${this.supportedEvents.length} events`,
    );
  }

  /**
   * Process an event and trigger webhook deliveries
   */
  async processEvent(eventName: string, data: any): Promise<void> {
    try {
      // Find active webhook subscriptions for this event
      const subscriptions = await this.webhookRepository.find({
        where: {
          event: eventName,
          isActive: true,
        },
      });

      if (subscriptions.length === 0) {
        return;
      }

      this.logger.debug(
        `Processing event ${eventName} for ${subscriptions.length} webhooks`,
      );

      // Add each delivery to the queue
      for (const subscription of subscriptions) {
        const payload = {
          id: crypto.randomUUID(),
          event: eventName,
          timestamp: new Date().toISOString(),
          data,
        };

        // Create delivery log entry
        const deliveryLog = this.deliveryLogRepository.create({
          webhookId: subscription.id,
          event: eventName,
          payload,
          status: 'queued',
          emailId: data.emailId,
        });
        await this.deliveryLogRepository.save(deliveryLog);

        // Add to queue
        await this.webhookQueue.add(
          'deliver',
          {
            webhookId: subscription.id,
            deliveryId: deliveryLog.id,
            payload,
          },
          {
            attempts: subscription.maxRetries || 5,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
            removeOnComplete: true,
          },
        );
      }
    } catch (error) {
      this.logger.error(
        `Error processing event ${eventName}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Create a new webhook subscription
   */
  async create(
    createWebhookDto: CreateWebhookDto,
    userId?: string,
  ): Promise<WebhookSubscription> {
    // Validate event type
    if (!this.supportedEvents.includes(createWebhookDto.event)) {
      throw new Error(`Unsupported event type: ${createWebhookDto.event}`);
    }

    // Create webhook
    const webhook = this.webhookRepository.create({
      ...createWebhookDto,
      userId,
    });

    return this.webhookRepository.save(webhook);
  }

  /**
   * Get all webhook subscriptions
   */
  async findAll(userId?: string): Promise<WebhookSubscription[]> {
    const query: any = {};

    // Filter by user ID if provided
    if (userId) {
      query.userId = userId;
    }

    return this.webhookRepository.find({
      where: query,
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Get a webhook subscription by ID
   */
  async findOne(id: string, userId?: string): Promise<WebhookSubscription> {
    const query: any = { id };

    // Filter by user ID if provided
    if (userId) {
      query.userId = userId;
    }

    return this.webhookRepository.findOne({
      where: query,
    });
  }

  /**
   * Update a webhook subscription
   */
  async update(
    id: string,
    updateWebhookDto: UpdateWebhookDto,
    userId?: string,
  ): Promise<WebhookSubscription> {
    // Find webhook
    const webhook = await this.findOne(id, userId);

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    // Validate event type if changing
    if (
      updateWebhookDto.event &&
      !this.supportedEvents.includes(updateWebhookDto.event)
    ) {
      throw new Error(`Unsupported event type: ${updateWebhookDto.event}`);
    }

    // Update webhook
    await this.webhookRepository.update(id, updateWebhookDto);

    return this.findOne(id, userId);
  }

  /**
   * Delete a webhook subscription
   */
  async remove(id: string, userId?: string): Promise<void> {
    // Find webhook
    const webhook = await this.findOne(id, userId);

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    await this.webhookRepository.delete(id);
  }

  /**
   * Get webhook delivery logs
   */
  async getDeliveryLogs(
    webhookId: string,
    limit = 20,
  ): Promise<WebhookDeliveryLog[]> {
    return this.deliveryLogRepository.find({
      where: { webhookId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Generate signature for webhook payload
   */
  generateSignature(payload: any, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }

  /**
   * Deliver webhook (called from queue processor)
   */
  async deliverWebhook(
    webhookId: string,
    deliveryId: string,
    payload: any,
  ): Promise<void> {
    // Find webhook and delivery log
    const [webhook, deliveryLog] = await Promise.all([
      this.webhookRepository.findOne({ where: { id: webhookId } }),
      this.deliveryLogRepository.findOne({ where: { id: deliveryId } }),
    ]);

    if (!webhook || !deliveryLog) {
      throw new Error('Webhook or delivery log not found');
    }

    // Update status and attempt count
    deliveryLog.status = 'processing';
    deliveryLog.attempt += 1;
    await this.deliveryLogRepository.save(deliveryLog);

    const startTime = Date.now();

    try {
      // Generate signature
      const signature = this.generateSignature(payload, webhook.secret);

      // Set up headers
      const headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'User-Agent': 'SecureMail-Webhook/1.0',
        ...webhook.headers,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        (webhook.timeout || 30) * 1000,
      );

      // Make HTTP request
      const response = await fetch(webhook.endpoint, {
        method: webhook.method || 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const status = response.status;
      const responseData = await response.text();

      const duration = Date.now() - startTime;

      // Check if successful (2xx status code)
      const isSuccess = status >= 200 && status < 300;

      // Update delivery log
      await this.deliveryLogRepository.update(deliveryId, {
        status: isSuccess ? 'success' : 'failed',
        statusCode: response.status,
        response: JSON.stringify({
          status: response.status,
          headers: response.headers,
          data: responseData,
        }),
        duration,
        completedAt: new Date(),
      });

      // Update webhook stats
      if (isSuccess) {
        await this.webhookRepository.update(webhookId, {
          lastSuccess: new Date(),
          successCount: () => '"successCount" + 1',
          failedAttempts: 0,
          lastErrorMessage: null,
        });

        this.logger.log(
          `Webhook ${webhookId} delivered successfully in ${duration}ms`,
        );
      } else {
        // Non-2xx response
        await this.webhookRepository.update(webhookId, {
          lastFailure: new Date(),
          failedAttempts: () => '"failedAttempts" + 1',
          lastErrorMessage: `HTTP ${response.status}: ${response.statusText}`,
        });

        this.logger.warn(
          `Webhook ${webhookId} failed with status ${response.status} in ${duration}ms`,
        );

        // Throw error to trigger retry
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      // Update delivery log
      await this.deliveryLogRepository.update(deliveryId, {
        status: 'failed',
        error: error.message,
        duration,
        completedAt: new Date(),
      });

      // Update webhook stats
      await this.webhookRepository.update(webhookId, {
        lastFailure: new Date(),
        failedAttempts: () => '"failedAttempts" + 1',
        lastErrorMessage: error.message,
      });

      this.logger.error(
        `Webhook ${webhookId} delivery error: ${error.message}`,
        error.stack,
      );

      // Check if max retries exceeded
      if (deliveryLog.attempt >= webhook.maxRetries) {
        this.logger.warn(
          `Webhook ${webhookId} max retries (${webhook.maxRetries}) exceeded`,
        );

        // If webhooks consistently fail, deactivate automatically
        const failedAttempts = webhook.failedAttempts + 1;
        if (failedAttempts >= 10) {
          await this.webhookRepository.update(webhookId, {
            isActive: false,
          });

          this.logger.warn(
            `Webhook ${webhookId} deactivated after ${failedAttempts} consecutive failures`,
          );
        }
      }

      // Rethrow to trigger Bull's retry mechanism
      throw error;
    }
  }

  /**
   * Get supported event types
   */
  getSupportedEvents(): string[] {
    return this.supportedEvents;
  }

  /**
   * Manually retry a failed delivery
   */
  async retryDelivery(deliveryId: string): Promise<void> {
    const deliveryLog = await this.deliveryLogRepository.findOne({
      where: { id: deliveryId },
    });

    if (!deliveryLog) {
      throw new Error('Delivery log not found');
    }

    if (deliveryLog.status !== 'failed') {
      throw new Error('Only failed deliveries can be retried');
    }

    // Reset status
    await this.deliveryLogRepository.update(deliveryId, {
      status: 'queued',
    });

    // Add to queue
    await this.webhookQueue.add(
      'deliver',
      {
        webhookId: deliveryLog.webhookId,
        deliveryId: deliveryLog.id,
        payload: deliveryLog.payload,
      },
      {
        attempts: 1, // Just try once for manual retry
        removeOnComplete: true,
      },
    );
  }
}

// // src/webhook/webhook.service.ts
// import { Injectable, Logger } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { WebhookSubscription } from './entities/webhook-subscription.entity';
// import { WebhookDeliveryLog } from './entities/webhook-delivery-log.entity';
// import { CreateWebhookDto } from './dto/create-webhook.dto';
// import { UpdateWebhookDto } from './dto/update-webhook.dto';
// import { Inject } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { InjectQueue } from '@nestjs/bull';
// import { EMAIL_SERVICE } from '../email/email.di-token';
// import * as crypto from 'crypto';
// import Queue from 'bull';
// import { IEmailService } from 'src/email/email.port';

// interface WebhookDeliveryJob {
//   webhookId: string;
//   event: string;
//   payload: any;
//   attempt: number;
// }

// @Injectable()
// export class WebhookService {
//   private readonly logger = new Logger(WebhookService.name);
//   private readonly webhookSecret: string;
//   private readonly webhookTimeout: number;

//   constructor(
//     @InjectRepository(WebhookSubscription)
//     private readonly webhookRepository: Repository<WebhookSubscription>,
//     @InjectRepository(WebhookDeliveryLog)
//     private readonly deliveryLogRepository: Repository<WebhookDeliveryLog>,
//     @Inject(EMAIL_SERVICE)
//     private readonly emailService: IEmailService,
//     private readonly configService: ConfigService,
//     @InjectQueue('webhook-queue')
//     private readonly webhookQueue: Queue<WebhookDeliveryJob>,
//   ) {
//     this.webhookSecret = this.configService.get<string>(
//       'WEBHOOK_SECRET',
//       'your-webhook-secret',
//     );
//     this.webhookTimeout = this.configService.get<number>(
//       'WEBHOOK_TIMEOUT',
//       10000,
//     ); // 10 seconds default
//     this.registerWebhookHandlers();
//   }

//   private registerWebhookHandlers(): void {
//     // Register handlers with the email service for different events
//     const events = [
//       'sent',
//       'delivered',
//       'opened',
//       'clicked',
//       'bounced',
//       'complained',
//       'failed',
//     ];
//     const emailService = this.emailService as IEmailService;

//     events.forEach((event) => {
//       emailService.registerWebhook(event, async (data) => {
//         await this.processWebhookEvent(event, data);
//       });
//     });

//     this.logger.log('Registered webhook handlers for email events');
//   }

//   private async processWebhookEvent(event: string, data: any): Promise<void> {
//     try {
//       // Find all active webhooks for this event
//       const webhooks = await this.webhookRepository.find({
//         where: { event, isActive: true },
//       });

//       this.logger.debug(
//         `Processing ${event} event, found ${webhooks.length} active webhooks`,
//       );

//       if (webhooks.length === 0) {
//         return;
//       }

//       // Queue delivery for each webhook
//       for (const webhook of webhooks) {
//         await this.queueWebhookDelivery(webhook.id, event, data);
//       }
//     } catch (error) {
//       this.logger.error(
//         `Error processing webhook event ${event}: ${error.message}`,
//         error.stack,
//       );
//     }
//   }

//   private async queueWebhookDelivery(
//     webhookId: string,
//     event: string,
//     payload: any,
//   ): Promise<void> {
//     try {
//       await this.webhookQueue.add(
//         'deliver-webhook',
//         {
//           webhookId,
//           event,
//           payload,
//           attempt: 1,
//         },
//         {
//           attempts: 1,
//           removeOnComplete: true,
//           removeOnFail: false,
//         },
//       );

//       this.logger.debug(
//         `Queued webhook delivery for webhookId=${webhookId}, event=${event}`,
//       );
//     } catch (error) {
//       this.logger.error(`Failed to queue webhook delivery: ${error.message}`);
//     }
//   }

//   async findAll(): Promise<WebhookSubscription[]> {
//     return this.webhookRepository.find({
//       order: { createdAt: 'DESC' },
//     });
//   }

//   async findByFilters(
//     filters: Record<string, any>,
//   ): Promise<WebhookSubscription[]> {
//     return this.webhookRepository.find({
//       where: filters,
//       order: { createdAt: 'DESC' },
//     });
//   }

//   async findOne(id: string): Promise<WebhookSubscription> {
//     return this.webhookRepository.findOne({ where: { id } });
//   }

//   async create(
//     createWebhookDto: CreateWebhookDto,
//   ): Promise<WebhookSubscription> {
//     // Normalize the webhook URL
//     const endpoint = this.normalizeUrl(createWebhookDto.endpoint);

//     // Generate a secret if not provided
//     const secret = createWebhookDto.secret || this.generateWebhookSecret();

//     const webhook = this.webhookRepository.create({
//       ...createWebhookDto,
//       endpoint,
//       secret,
//       headers: createWebhookDto.headers || {},
//       // method: createWebhookDto.method || 'POST'
//       method: 'POST',
//     });

//     const savedWebhook = await this.webhookRepository.save(webhook);

//     this.logger.log(
//       `Created new webhook subscription with ID: ${savedWebhook.id}`,
//     );

//     return savedWebhook;
//   }

//   async update(
//     id: string,
//     updateWebhookDto: UpdateWebhookDto,
//   ): Promise<WebhookSubscription> {
//     // Normalize URL if provided
//     if (updateWebhookDto.endpoint) {
//       updateWebhookDto.endpoint = this.normalizeUrl(updateWebhookDto.endpoint);
//     }

//     // Update the webhook
//     await this.webhookRepository.update(id, updateWebhookDto);

//     this.logger.log(`Updated webhook subscription with ID: ${id}`);

//     return this.webhookRepository.findOne({ where: { id } });
//   }

//   async remove(id: string): Promise<void> {
//     await this.webhookRepository.delete(id);
//     this.logger.log(`Deleted webhook subscription with ID: ${id}`);
//   }

//   private normalizeUrl(url: string): string {
//     // Ensure URL starts with http:// or https://
//     if (!url.startsWith('http://') && !url.startsWith('https://')) {
//       return `https://${url}`;
//     }
//     return url;
//   }

//   private generateWebhookSecret(): string {
//     return crypto.randomBytes(24).toString('hex');
//   }

//   generateSignature(payload: any, secret: string): string {
//     const hmac = crypto.createHmac('sha256', secret);
//     hmac.update(JSON.stringify(payload));
//     return hmac.digest('hex');
//   }

//   async sendWebhook(
//     webhook: WebhookSubscription,
//     data: any,
//   ): Promise<{
//     success: boolean;
//     statusCode?: number;
//     response?: any;
//     error?: string;
//   }> {
//     try {
//       // Prepare the webhook payload
//       const timestamp = new Date().toISOString();
//       const payload = {
//         ...data,
//         timestamp,
//       };

//       // Generate signature for verification
//       const signature = this.generateSignature(payload, webhook.secret);

//       // Default headers
//       const headers = {
//         'Content-Type': 'application/json',
//         'User-Agent': 'SecureMail-Webhook/1.0',
//         'X-SecureMail-Event': data.event,
//         'X-SecureMail-Delivery': Date.now().toString(),
//         'X-SecureMail-Signature': signature,
//         ...webhook.headers,
//       };

//       const startTime = Date.now();

//       // Send the webhook using fetch API with timeout
//       const controller = new AbortController();
//       const timeoutId = setTimeout(
//         () => controller.abort(),
//         webhook.timeout || this.webhookTimeout,
//       );

//       try {
//         const response = await fetch(webhook.endpoint, {
//           method: webhook.method || 'POST',
//           headers,
//           body: JSON.stringify(payload),
//           signal: controller.signal,
//         });

//         clearTimeout(timeoutId);

//         const duration = Date.now() - startTime;
//         const statusCode = response.status;
//         let responseData;

//         try {
//           responseData = await response.text();
//         } catch (error) {
//           responseData = 'Failed to get response body';
//         }

//         // Update webhook stats
//         if (response.ok) {
//           await this.updateWebhookSuccess(webhook);

//           this.logger.debug(
//             `Webhook delivery successful: webhookId=${webhook.id}, statusCode=${statusCode}, duration=${duration}ms`,
//           );

//           return {
//             success: true,
//             statusCode,
//             response: responseData,
//             error: null,
//           };
//         } else {
//           const errorMessage = `HTTP status ${statusCode}: ${responseData}`;
//           await this.updateWebhookFailure(webhook, errorMessage);

//           this.logger.warn(
//             `Webhook delivery failed: webhookId=${webhook.id}, statusCode=${statusCode}, error=${errorMessage}`,
//           );

//           return {
//             success: false,
//             statusCode,
//             response: responseData,
//             error: errorMessage,
//           };
//         }
//       } catch (error) {
//         clearTimeout(timeoutId);

//         // Handle timeout or network errors
//         const errorMessage =
//           error.name === 'AbortError'
//             ? `Request timed out after ${webhook.timeout || this.webhookTimeout}ms`
//             : error.message;

//         await this.updateWebhookFailure(webhook, errorMessage);

//         this.logger.error(
//           `Webhook delivery error: ${errorMessage}`,
//           error.stack,
//         );

//         return {
//           success: false,
//           error: errorMessage,
//         };
//       }
//     } catch (error) {
//       await this.updateWebhookFailure(webhook, error.message);

//       this.logger.error(
//         `Webhook processing error: ${error.message}`,
//         error.stack,
//       );

//       return {
//         success: false,
//         error: error.message,
//       };
//     }
//   }

//   private async updateWebhookSuccess(
//     webhook: WebhookSubscription,
//   ): Promise<void> {
//     webhook.lastSuccess = new Date();
//     webhook.failedAttempts = 0;
//     webhook.successCount += 1;
//     webhook.lastErrorMessage = null;
//     await this.webhookRepository.save(webhook);
//   }

//   private async updateWebhookFailure(
//     webhook: WebhookSubscription,
//     errorMessage: string,
//   ): Promise<void> {
//     webhook.failedAttempts += 1;
//     webhook.lastFailure = new Date();
//     webhook.lastErrorMessage = errorMessage;

//     // If too many failures, disable the webhook
//     if (webhook.failedAttempts >= webhook.maxRetries) {
//       webhook.isActive = false;
//       this.logger.warn(
//         `Deactivated webhook ${webhook.id} after ${webhook.failedAttempts} failures. Last error: ${errorMessage}`,
//       );
//     }

//     await this.webhookRepository.save(webhook);
//   }

//   async testWebhook(
//     id: string,
//   ): Promise<{ success: boolean; message: string; details?: any }> {
//     const webhook = await this.webhookRepository.findOne({ where: { id } });

//     if (!webhook) {
//       throw new Error('Webhook not found');
//     }

//     const testPayload = {
//       id: crypto.randomUUID(),
//       event: webhook.event,
//       emailId: 'test-email-id',
//       recipient: 'test@example.com',
//       metadata: { test: true },
//     };

//     try {
//       const result = await this.sendWebhook(webhook, testPayload);

//       if (result.success) {
//         return {
//           success: true,
//           message: `Test webhook successfully sent to ${webhook.endpoint}`,
//           details: {
//             statusCode: result.statusCode,
//             response: result.response,
//           },
//         };
//       } else {
//         return {
//           success: false,
//           message: `Failed to send test webhook: ${result.error}`,
//           details: {
//             statusCode: result.statusCode,
//             response: result.response,
//             error: result.error,
//           },
//         };
//       }
//     } catch (error) {
//       return {
//         success: false,
//         message: `Failed to send test webhook: ${error.message}`,
//         details: { error: error.message },
//       };
//     }
//   }

//   async findByEvent(event: string): Promise<WebhookSubscription[]> {
//     return this.webhookRepository.find({
//       where: { event, isActive: true },
//     });
//   }

//   async resetFailureCount(id: string): Promise<WebhookSubscription> {
//     const webhook = await this.webhookRepository.findOne({ where: { id } });

//     if (!webhook) {
//       throw new Error('Webhook not found');
//     }

//     webhook.failedAttempts = 0;
//     webhook.isActive = true;
//     webhook.lastErrorMessage = null;

//     return this.webhookRepository.save(webhook);
//   }

//   async retryDelivery(
//     deliveryLog: WebhookDeliveryLog,
//   ): Promise<{ success: boolean; message: string }> {
//     try {
//       await this.webhookQueue.add(
//         'deliver-webhook',
//         {
//           webhookId: deliveryLog.webhookId,
//           event: deliveryLog.event,
//           payload: deliveryLog.payload,
//           attempt: 1, // Reset attempt counter
//         },
//         {
//           attempts: 1,
//           removeOnComplete: true,
//         },
//       );

//       // Update the delivery log
//       deliveryLog.status = 'pending';
//       await this.deliveryLogRepository.save(deliveryLog);

//       this.logger.log(
//         `Requeued webhook delivery for log ID: ${deliveryLog.id}`,
//       );

//       return {
//         success: true,
//         message: 'Webhook delivery retry has been queued',
//       };
//     } catch (error) {
//       this.logger.error(
//         `Failed to retry webhook delivery: ${error.message}`,
//         error.stack,
//       );
//       return {
//         success: false,
//         message: `Failed to retry webhook delivery: ${error.message}`,
//       };
//     }
//   }

//   /**
//    * Get delivery logs for a webhook
//    */
//   async getDeliveryLogs(
//     webhookId: string,
//     options: {
//       page?: number;
//       limit?: number;
//       status?: string;
//     } = {},
//   ): Promise<{
//     data: WebhookDeliveryLog[];
//     total: number;
//     page: number;
//     pages: number;
//   }> {
//     const { page = 1, limit = 20, status } = options;

//     const where: any = { webhookId };

//     if (status) {
//       where.status = status;
//     }

//     const [data, total] = await this.deliveryLogRepository.findAndCount({
//       where,
//       order: { createdAt: 'DESC' },
//       skip: (page - 1) * limit,
//       take: limit,
//     });

//     return {
//       data,
//       total,
//       page,
//       pages: Math.ceil(total / limit),
//     };
//   }

//   /**
//    * Get webhook delivery log by ID
//    */
//   async getDeliveryLog(id: string): Promise<WebhookDeliveryLog> {
//     return this.deliveryLogRepository.findOne({ where: { id } });
//   }
// }
