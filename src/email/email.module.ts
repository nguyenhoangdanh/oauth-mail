// src/email/email.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule, BullRootModuleOptions } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EMAIL_SERVICE } from './email.di-token';
import { NodemailerService } from './nodemailer.service';
import { ConsoleEmailService } from './console.service';
import { EmailWebhookController } from './email.webhook.controller';
import { EmailDashboardController } from './email-dashboard.controller';
import { EmailTemplateController } from './email-template.controller';
import { EmailController } from './email.controller';
import { EmailEventListener } from './email-event.listener';
import { EmailLog } from './entities/email-log.entity';
import { EmailEvent } from './entities/email-event.entity';
import { EmailStats } from './entities/email-stats.entity';
import { EmailTemplate } from './entities/email-template.entity';
import { EmailTrackingHelper } from './email.tracking.helper';
import { ScheduleModule } from '@nestjs/schedule';
import { EmailStatsCronService } from './email-stats.cron.service';
import { OAuth2Service } from './oauth2.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([EmailLog, EmailEvent, EmailStats, EmailTemplate]),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        return {
          redis: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get('REDIS_PORT', 6379),
            password: configService.get('REDIS_PASSWORD', ''),
          },
        } as BullRootModuleOptions;
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'email-queue',
    }),
    AuthModule,
  ],
  controllers: [
    EmailController,
    EmailWebhookController,
    EmailDashboardController,
    EmailTemplateController,
  ],
  providers: [
    {
      provide: EMAIL_SERVICE,
      useFactory: (
        configService: ConfigService,
        eventEmitter: EventEmitter2,
        oauth2Service: OAuth2Service,
      ) => {
        const emailEnabled =
          configService.get<string>('EMAIL_ENABLED', 'false') === 'true';

        if (!emailEnabled) {
          return new ConsoleEmailService();
        }

        return new NodemailerService(
          configService,
          eventEmitter,
          oauth2Service,
        );
      },
      inject: [ConfigService, EventEmitter2, OAuth2Service],
    },
    EmailEventListener,
    EmailTrackingHelper,
    EmailStatsCronService,
    OAuth2Service,
  ],
  exports: [EMAIL_SERVICE, EmailTrackingHelper, OAuth2Service],
})
export class EmailModule {}

// import { Module } from '@nestjs/common';
// import { ConfigModule, ConfigService } from '@nestjs/config';
// import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
// import { BullModule } from '@nestjs/bull';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { EMAIL_SERVICE } from './email.di-token';
// import { NodemailerService } from './nodemailer.service';
// import { ConsoleEmailService } from './console.service';
// import { EmailWebhookController } from './email.webhook.controller';
// import { EmailDashboardController } from './email-dashboard.controller';
// import { EmailEventListener } from './email-event.listener';
// import { EmailLog } from './entities/email-log.entity';
// import { EmailEvent } from './entities/email-event.entity';
// import { EmailStats } from './entities/email-stats.entity';
// import { EmailTemplate } from './entities/email-template.entity';
// import { EmailTrackingHelper } from './email.tracking.helper';
// import { ScheduleModule } from '@nestjs/schedule';
// import { EmailStatsCronService } from './email-stats.cron.service';

// @Module({
//   imports: [
//     ConfigModule,
//     TypeOrmModule.forFeature([EmailLog, EmailEvent, EmailStats, EmailTemplate]),
//     EventEmitterModule.forRoot(),
//     ScheduleModule.forRoot(),
//     BullModule.forRootAsync({
//       imports: [ConfigModule],
//       useFactory: async (configService: ConfigService) => ({
//         redis: {
//           host: configService.get('REDIS_HOST', 'localhost'),
//           port: configService.get('REDIS_PORT', 6379),
//           password: configService.get('REDIS_PASSWORD', ''),
//         },
//       }),
//       inject: [ConfigService],
//     }),
//     BullModule.registerQueue({
//       name: 'email-queue',
//     }),
//   ],
//   controllers: [EmailWebhookController, EmailDashboardController],
//   providers: [
//     {
//       provide: EMAIL_SERVICE,
//       useFactory: (
//         configService: ConfigService,
//         eventEmitter: EventEmitter2,
//       ) => {
//         const emailEnabled =
//           configService.get<string>('EMAIL_ENABLED', 'false') === 'true';

//         if (!emailEnabled) {
//           return new ConsoleEmailService();
//         }

//         return new NodemailerService(configService, eventEmitter);
//       },
//       inject: [ConfigService, EventEmitter2],
//     },
//     EmailEventListener,
//     EmailTrackingHelper,
//     EmailStatsCronService,
//   ],
//   exports: [EMAIL_SERVICE, EmailTrackingHelper],
// })
// export class EmailModule {}
