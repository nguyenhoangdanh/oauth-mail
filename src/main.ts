// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import cookieParser from 'cookie-parser';
import compression from 'compression';

async function bootstrap() {
  // Create logger instance
  const logger = new Logger('Bootstrap');
  
  try {
    // Create the NestJS application
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });
    
    const configService = app.get(ConfigService);
    const isProduction = configService.get('NODE_ENV') === 'production';
    
    // Global filters for exception handling
    app.useGlobalFilters(new GlobalExceptionFilter());
    
    // Apply security middleware
    app.use(cookieParser(configService.get('COOKIE_SECRET', configService.get('JWT_SECRET'))));
    
    // Apply compression to reduce response size
    app.use(compression());
    
    // Security with Helmet
    app.use(
      helmet({
        contentSecurityPolicy: isProduction,
        crossOriginEmbedderPolicy: isProduction,
        crossOriginOpenerPolicy: isProduction,
        crossOriginResourcePolicy: isProduction ? { policy: 'same-site' } : false,
      }),
    );
    
    // Enable CORS
    const corsOrigins = configService.get<string>('CORS_ORIGINS', '*');
    app.enableCors({
      origin: corsOrigins === '*' ? '*' : corsOrigins.split(','),
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
      allowedHeaders: 'Content-Type,Accept,Authorization',
      maxAge: 3600,
    });
    
    // Validation pipes
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
        forbidUnknownValues: true,
        disableErrorMessages: isProduction,
      }),
    );
    
    // Setup Swagger documentation (only for non-production environments)
    if (!isProduction) {
      const swaggerConfig = new DocumentBuilder()
        .setTitle('SecureMail by DN API')
        .setDescription('API documentation for SecureMail by DN - A robust email service with webhooks')
        .setVersion('1.0')
        .addTag('email', 'Email sending and template operations')
        .addTag('webhooks', 'Webhook subscription management')
        .addTag('email-dashboard', 'Email analytics and reporting')
        .addTag('oauth', 'OAuth configuration for email providers')
        .addBearerAuth()
        .build();
      
      const document = SwaggerModule.createDocument(app, swaggerConfig);
      SwaggerModule.setup('api-docs', app, document);
      logger.log('Swagger documentation enabled at /api-docs');
    }
    
    // Set global prefix for all routes (optional)
    const apiPrefix = configService.get<string>('API_PREFIX', 'api');
    if (apiPrefix) {
      app.setGlobalPrefix(apiPrefix);
    }
    
    // Start server
    const port = configService.get<number>('PORT', 8001);
    await app.listen(port);
    
    // Log startup information
    const appUrl = await app.getUrl();
    logger.log(`Application is running on: ${appUrl}`);
    
    if (!isProduction) {
      logger.log(`Swagger documentation: ${appUrl}/api-docs`);
    }
    
    logger.log(`Environment: ${configService.get('NODE_ENV', 'development')}`);
  } catch (error) {
    logger.error(`Failed to start application: ${error.message}`, error.stack);
    process.exit(1);
  }
}

bootstrap();

// // src/main.ts
// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';
// import { ConfigService } from '@nestjs/config';
// import { ValidationPipe } from '@nestjs/common';
// import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
// import cookieParser from 'cookie-parser';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);
//   const configService = app.get(ConfigService);

//   // Apply security middleware
//   app.use(cookieParser());

//   // Enable CORS
//   app.enableCors({
//     origin: configService.get('CORS_ORIGINS', '*'),
//     methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
//     credentials: true,
//   });

//   // Validation pipes
//   app.useGlobalPipes(
//     new ValidationPipe({
//       whitelist: true,
//       transform: true,
//       forbidNonWhitelisted: true,
//     }),
//   );

//   // Lưu ý: ThrottlerModule và ThrottlerGuard nên được cấu hình trong AppModule
//   // thay vì ở đây. Phần dưới đây tôi sẽ giải thích cách cấu hình trong AppModule

//   // Setup Swagger
//   const swaggerConfig = new DocumentBuilder()
//     .setTitle('SecureMail by DN API')
//     .setDescription('API documentation for SecureMail by DN')
//     .setVersion('1.0')
//     .addTag('email')
//     .addBearerAuth()
//     .build();

//   const document = SwaggerModule.createDocument(app, swaggerConfig);
//   SwaggerModule.setup('api-docs', app, document);

//   // Start server
//   const port = configService.get('PORT', 8001);
//   await app.listen(port);
//   console.log(`Application is running on: http://localhost:${port}`);
//   console.log(`Swagger documentation: http://localhost:${port}/api-docs`);
// }
// bootstrap();
