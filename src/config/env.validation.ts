// src/config/env.validation.ts
import { plainToClass } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  @IsOptional()
  PORT?: number;

  @IsString()
  @IsOptional()
  DATABASE_URL?: string;

  @IsString()
  @IsOptional()
  DB_HOST?: string;

  @IsNumber()
  @IsOptional()
  DB_PORT?: number;

  @IsString()
  @IsOptional()
  DB_USERNAME?: string;

  @IsString()
  @IsOptional()
  DB_PASSWORD?: string;

  @IsString()
  @IsOptional()
  DB_DATABASE?: string;

  @IsString()
  @IsOptional()
  REDIS_HOST?: string;

  @IsNumber()
  @IsOptional()
  REDIS_PORT?: number;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN?: string;

  @IsString()
  @IsOptional()
  APP_NAME?: string;

  @IsString()
  @IsOptional()
  APP_URL?: string;

  @IsString()
  @IsOptional()
  EMAIL_HOST?: string;

  @IsNumber()
  @IsOptional()
  EMAIL_PORT?: number;

  @IsString()
  @IsOptional()
  EMAIL_USER?: string;

  @IsString()
  @IsOptional()
  EMAIL_PASS?: string;

  @IsString()
  @IsOptional()
  EMAIL_FROM?: string;

  @IsString()
  @IsOptional()
  GMAIL_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  GMAIL_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  GMAIL_REFRESH_TOKEN?: string;

  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
