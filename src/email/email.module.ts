// src/email/email.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

// Controllers
import { EmailController } from './email.controller';
import { EmailDashboardController } from './email-dashboard.controller';
import { EmailTemplateController } from './email-template.controller';
import { OAuth2Controller } from './oauth2.controller';

// Services
import { EmailService } from './email.service';
import { OAuth2Service } from './oauth2.service';
import { EmailTrackingHelper } from './email.tracking.helper';
import { EmailStatsCronService } from './email-stats.cron.service';
import { EMAIL_SERVICE } from './email.di-token';
import { ConsoleEmailService } from './console.service';

// Processors
import { EmailProcessor } from './email.processor';
import { EmailEventListener } from './email-event.listener';

// Entities
import { EmailLog } from './entities/email-log.entity';
import { EmailEvent } from './entities/email-event.entity';
import { EmailStats } from './entities/email-stats.entity';
import { EmailTemplate } from './entities/email-template.entity';
import { OAuthCredential } from './entities/oauth-credential.entity';

// Auth
import { AuthModule } from '../auth/auth.module';
import { WebhookController } from 'src/webhook/webhook.controller';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      EmailLog, 
      EmailEvent, 
      EmailStats, 
      EmailTemplate,
      OAuthCredential
    ]),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    BullModule.registerQueue({
      name: 'email-queue',
    }),
    AuthModule,
  ],
  controllers: [
    EmailController,
    WebhookController,
    EmailDashboardController,
    EmailTemplateController,
    OAuth2Controller,
  ],
  providers: [
    // Main service provider with factory function
    {
      provide: EMAIL_SERVICE,
      useFactory: (
        configService: ConfigService,
        emailService: EmailService,
        consoleService: ConsoleEmailService,
      ) => {
        const emailEnabled = configService.get<string>('EMAIL_ENABLED', 'false') === 'true';
        return emailEnabled ? emailService : consoleService;
      },
      inject: [ConfigService, EmailService, ConsoleEmailService],
    },
    // Service implementations
    EmailService,
    ConsoleEmailService,
    EmailTrackingHelper,
    EmailStatsCronService,
    OAuth2Service,
    
    // Event listeners and processors
    EmailEventListener,
    EmailProcessor,
  ],
  exports: [
    EMAIL_SERVICE,
    EmailService,
    EmailTrackingHelper,
    OAuth2Service,
  ],
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
