// src/webhook/webhook.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { WebhookProcessor } from './webhook.processor';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { WebhookDeliveryLog } from './entities/webhook-delivery-log.entity';
import { EVENT_EMITTER_TOKEN } from '../common/events/event-emitter.di-token';
import EventEmitter from 'events';
import { AuthModule } from 'src/auth/auth.module';
import { Session } from 'src/users/entities/session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WebhookSubscription,
      WebhookDeliveryLog,
      Session,
    ]),
    BullModule.registerQueue({
      name: 'webhook',
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: true,
      },
    }),
    ConfigModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [WebhookController],
  providers: [
    WebhookService,
    WebhookProcessor,
    {
      provide: EVENT_EMITTER_TOKEN,
      useFactory: () => {
        // const EventEmitter = require('events');
        return new EventEmitter();
      },
    },
  ],
  exports: [WebhookService],
})
export class WebhookModule {}
