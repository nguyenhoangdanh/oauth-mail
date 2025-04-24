// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Global filters
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Apply security middleware
  app.use(cookieParser());

  // Security with Helmet
  app.use(
    helmet({
      contentSecurityPolicy: configService.get('NODE_ENV') === 'production',
      crossOriginEmbedderPolicy: configService.get('NODE_ENV') === 'production',
    }),
  );

  // Enable CORS
  app.enableCors({
    origin: configService.get('CORS_ORIGINS', '*'),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Validation pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Setup Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('SecureMail by DN API')
    .setDescription('API documentation for SecureMail by DN')
    .setVersion('1.0')
    .addTag('email')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document);

  // Start server
  const port = configService.get('PORT', 8001);
  await app.listen(port);

  // Log startup information
  const appUrl = await app.getUrl();
  console.log(`Application is running on: ${appUrl}`);
  console.log(`Swagger documentation: ${appUrl}/api-docs`);
  console.log(`Environment: ${configService.get('NODE_ENV', 'development')}`);
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
