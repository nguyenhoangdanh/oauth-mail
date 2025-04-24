// src/database/database.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { Logger } from '@nestjs/common';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('DatabaseModule');
        
        // Check if DATABASE_URL is provided (e.g., for deployment environments)
        const databaseUrl = configService.get<string>('DATABASE_URL');
        
        if (databaseUrl) {
          logger.log('Using DATABASE_URL for connection');
          return {
            type: 'postgres',
            url: databaseUrl,
            entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
            migrations: [join(__dirname, './migrations/*{.ts,.js}')],
            synchronize: configService.get<boolean>('DB_SYNCHRONIZE', false),
            logging: configService.get<boolean>('DB_LOGGING', false),
            ssl:false,
            autoLoadEntities: true,
            keepConnectionAlive: true,
            retryAttempts: 5,
            retryDelay: 3000,
          };
        }
        
        // Otherwise use individual connection parameters
        logger.log('Using individual database parameters for connection');
        return {
          type: 'postgres',
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: configService.get<number>('DB_PORT', 5433),
          username: configService.get<string>('DB_USERNAME', 'postgres'),
          password: configService.get<string>('DB_PASSWORD', ''),
          database: configService.get<string>('DB_DATABASE', 'securemail'),
          entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
          migrations: [join(__dirname, './migrations/*{.ts,.js}')],
          synchronize: configService.get<boolean>('DB_SYNCHRONIZE', false),
          logging: configService.get<boolean>('DB_LOGGING', false),
          ssl: false,
          autoLoadEntities: true,
          keepConnectionAlive: true,
          retryAttempts: 5,
          retryDelay: 3000,
        };
      },
    }),
  ],
})
export class DatabaseModule {}