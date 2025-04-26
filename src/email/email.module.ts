// src/email/email.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { EmailTemplateController } from './email-template.controller';
import { EmailQueue } from './email.queue';
import { EmailLog } from './entities/email-log.entity';
import { EmailTemplate } from './entities/email-template.entity';
import { EmailEvent } from './entities/email-event.entity';
import { EMAIL_SERVICE } from './email.di-token';
import { EVENT_EMITTER_TOKEN } from '../common/events/event-emitter.di-token';
import { EmailStats } from './entities/email-stats.entity';
import EventEmitter from 'events';
import { AuthModule } from 'src/auth/auth.module';
import { Session } from 'src/users/entities/session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmailLog,
      EmailTemplate,
      EmailEvent,
      EmailStats,
      Session,
    ]),
    BullModule.registerQueue({
      name: 'email',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: true,
      },
    }),
    ConfigModule,
    EventEmitterModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [EmailController, EmailTemplateController],
  providers: [
    {
      provide: EMAIL_SERVICE,
      useClass: EmailService,
    },
    {
      provide: EVENT_EMITTER_TOKEN,
      useFactory: () => {
        // const EventEmitter = require('events');
        return new EventEmitter();
      },
    },
    EmailQueue,
  ],
  exports: [EMAIL_SERVICE],
})
export class EmailModule {}
