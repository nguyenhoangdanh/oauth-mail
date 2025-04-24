// src/app.module.ts
// Modification to ensure proper module initialization order
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { AppCacheModule } from './common/cache/cache.module';
import { EmailModule } from './email/email.module';
import { WebhookModule } from './webhook/webhook.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { validate } from './config/env.validation';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { SecurityMiddleware } from './common/middleware/security.middleware';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    // Config with validation
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      expandVariables: true,
      cache: true,
    }),

    // Database connection
    DatabaseModule,

    // Cache configuration
    AppCacheModule.register(),

    // Event Emitter for internal events
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),

    // Scheduled tasks
    ScheduleModule.forRoot(),

    // Redis queue for background jobs
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          redis: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get('REDIS_PORT', 6380),
            password: configService.get('REDIS_PASSWORD', ''),
          },
          prefix: 'bull',
        } as any;
      },
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.get<number>('THROTTLE_TTL', 60) * 1000,
            limit: configService.get<number>('THROTTLE_LIMIT', 60),
          },
        ],
      }),
    }),

    // Feature modules - Ensure correct order to resolve dependencies
    AuthModule,
    EmailModule,
    WebhookModule, // WebhookModule should come after EmailModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    // Throttler guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply security middleware to all routes
    consumer.apply(SecurityMiddleware).forRoutes('*');
  }
}

// // src/app.module.ts
// import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
// import { AppController } from './app.controller';
// import { AppService } from './app.service';
// import { ConfigModule, ConfigService } from '@nestjs/config';
// import { APP_FILTER, APP_GUARD } from '@nestjs/core';
// import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
// import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
// import { AppCacheModule } from './common/cache/cache.module';
// import { EmailModule } from './email/email.module';
// import { WebhookModule } from './webhook/webhook.module';
// import { AuthModule } from './auth/auth.module';
// import { DatabaseModule } from './database/database.module';
// import { validate } from './config/env.validation';
// import { EventEmitterModule } from '@nestjs/event-emitter';
// import { ScheduleModule } from '@nestjs/schedule';
// import { SecurityMiddleware } from './common/middleware/security.middleware';
// import { BullModule } from '@nestjs/bull';
// import { BullRootModuleOptions } from '@nestjs/bull/dist/interfaces';

// @Module({
//   imports: [
//     // Config with validation
//     ConfigModule.forRoot({
//       isGlobal: true,
//       validate,
//       expandVariables: true,
//       cache: true,
//     }),

//     // Database connection
//     DatabaseModule,

//     // Cache configuration
//     AppCacheModule.register(),

//     // Event Emitter for internal events
//     EventEmitterModule.forRoot({
//       wildcard: true,
//       delimiter: '.',
//       newListener: false,
//       removeListener: false,
//       maxListeners: 20,
//       verboseMemoryLeak: true,
//       ignoreErrors: false,
//     }),

//     // Scheduled tasks
//     ScheduleModule.forRoot(),

//     // Redis queue for background jobs
//     BullModule.forRootAsync({
//       imports: [ConfigModule],
//       inject: [ConfigService],
//       useFactory: (configService: ConfigService) => {
//         return {
//           redis: {
//             host: configService.get('REDIS_HOST', 'localhost'),
//             port: configService.get('REDIS_PORT', 6380),
//             password: configService.get('REDIS_PASSWORD', ''),
//           },
//           prefix: 'bull',
//         } as any;
//       },
//     }),

//     // Rate limiting
//     ThrottlerModule.forRootAsync({
//       imports: [ConfigModule],
//       inject: [ConfigService],
//       useFactory: (configService: ConfigService) => ({
//         throttlers: [
//           {
//             ttl: configService.get<number>('THROTTLE_TTL', 60) * 1000,
//             limit: configService.get<number>('THROTTLE_LIMIT', 60),
//           },
//         ],
//       }),
//     }),

//     // Feature modules
//     AuthModule,
//     EmailModule,
//     WebhookModule,
//   ],
//   controllers: [AppController],
//   providers: [
//     AppService,
//     // Global exception filter
//     {
//       provide: APP_FILTER,
//       useClass: GlobalExceptionFilter,
//     },
//     // Throttler guard
//     {
//       provide: APP_GUARD,
//       useClass: ThrottlerGuard,
//     },
//   ],
// })
// export class AppModule implements NestModule {
//   configure(consumer: MiddlewareConsumer) {
//     // Apply security middleware to all routes
//     consumer.apply(SecurityMiddleware).forRoutes('*');
//   }
// }

// // src/app.module.ts
// import { Module } from '@nestjs/common';
// import { AppController } from './app.controller';
// import { AppService } from './app.service';
// import { ConfigModule } from '@nestjs/config';
// import { APP_FILTER, APP_GUARD } from '@nestjs/core';
// import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
// import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
// import { AppCacheModule } from './common/cache/cache.module';
// import { EmailModule } from './email/email.module';
// import { WebhookModule } from './webhook/webhook.module';
// import { AuthModule } from './auth/auth.module';
// import { DatabaseModule } from './database/database.module';
// import { validate } from './config/env.validation';

// @Module({
//   imports: [
//     // Config with validation
//     ConfigModule.forRoot({
//       isGlobal: true,
//       validate,
//     }),

//     // Database
//     DatabaseModule,

//     // Cache
//     AppCacheModule.register(),

//     // Rate limiting
//     ThrottlerModule.forRoot({
//       throttlers: [
//         {
//           ttl: 60000, // 60 seconds
//           limit: 60, // 60 requests per minute
//         },
//       ],
//     }),

//     // Feature modules
//     AuthModule,
//     EmailModule,
//     WebhookModule,
//   ],
//   controllers: [AppController],
//   providers: [
//     AppService,
//     // Global exception filter
//     {
//       provide: APP_FILTER,
//       useClass: GlobalExceptionFilter,
//     },
//     // Throttler guard
//     {
//       provide: APP_GUARD,
//       useClass: ThrottlerGuard,
//     },
//   ],
// })
// export class AppModule {}

// // src/app.module.ts
// import { Module } from '@nestjs/common';
// import { AppController } from './app.controller';
// import { AppService } from './app.service';
// import { AppCacheModule } from './common/cache/cache.module';
// import { ConfigModule, ConfigService } from '@nestjs/config';
// import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
// import { APP_GUARD } from '@nestjs/core';

// @Module({
//   imports: [
//     ConfigModule.forRoot({
//       isGlobal: true,
//     }),
//     AppCacheModule.register(),

//     ThrottlerModule.forRootAsync({
//       imports: [ConfigModule],
//       inject: [ConfigService],
//       useFactory: (config: ConfigService) => ({
//         throttlers: [
//           {
//             ttl: config.get('THROTTLE_TTL', 60),
//             limit: config.get('THROTTLE_LIMIT', 60),
//           },
//         ],
//       }),
//     }),

//     // Các module khác...
//   ],
//   controllers: [AppController],
//   providers: [
//     AppService,
//     {
//       provide: APP_GUARD,
//       useClass: ThrottlerGuard, // Sử dụng ThrottlerGuard mặc định
//     },
//   ],
// })
// export class AppModule {}

// // src/app.module.ts
// import { Module } from '@nestjs/common';
// import { AppController } from './app.controller';
// import { AppService } from './app.service';
// import { AppCacheModule } from './common/cache/cache.module';
// import { ConfigModule, ConfigService } from '@nestjs/config';
// import { ThrottlerModule, ThrottlerOptionsFactory, ThrottlerStorage } from '@nestjs/throttler';
// import { APP_GUARD } from '@nestjs/core';
// import { CustomThrottlerGuard } from './common/guards/throttler.guard';
// import { Reflector } from '@nestjs/core';

// @Module({
//   imports: [
//     ConfigModule.forRoot({
//       isGlobal: true,
//     }),
//     AppCacheModule.register(),

//     ThrottlerModule.forRootAsync({
//       imports: [ConfigModule],
//       inject: [ConfigService],
//       useFactory: (config: ConfigService) => ({
//         throttlers: [
//           {
//             ttl: config.get('THROTTLE_TTL', 60),
//             limit: config.get('THROTTLE_LIMIT', 60),
//           },
//         ],
//       }),
//     }),

//     // Các module khác...
//   ],
//   controllers: [AppController],
//   providers: [
//     AppService,
//     {
//       provide: APP_GUARD,
//       useFactory: (
//         configService: ConfigService,
//         options: Record<string, any>,
//         storageService: ThrottlerStorage,
//         reflector: Reflector
//       ) => {
//         return new CustomThrottlerGuard(
//           configService,
//           options,
//           storageService,
//           reflector
//         );
//       },
//       inject: [ConfigService, 'THROTTLER_OPTIONS', 'THROTTLER_STORAGE', Reflector],
//     },
//   ],
// })
// export class AppModule {}
