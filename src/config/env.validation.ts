// src/config/env.validation.ts
import { plainToClass } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  validateSync,
  IsEnum,
  IsNotEmpty,
  IsUrl,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
  Staging = 'staging',
}

class EnvironmentVariables {
  // Node environment
  @IsEnum(Environment)
  NODE_ENV: Environment;

  // Server settings
  @IsNumber()
  @IsOptional()
  PORT?: number;

  @IsString()
  @IsOptional()
  API_PREFIX?: string;

  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  APP_URL: string;

  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  FRONTEND_URL: string;

  // CORS settings
  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string;

  // Database settings
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

  @IsBoolean()
  @IsOptional()
  DB_SYNCHRONIZE?: boolean;

  @IsBoolean()
  @IsOptional()
  DB_LOGGING?: boolean;

  // Redis settings
  @IsString()
  @IsOptional()
  REDIS_HOST?: string;

  @IsNumber()
  @IsOptional()
  REDIS_PORT?: number;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  // JWT settings
  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN?: string;

  // Rate limiting
  @IsNumber()
  @IsOptional()
  THROTTLE_TTL?: number;

  @IsNumber()
  @IsOptional()
  THROTTLE_LIMIT?: number;

  // Cookie settings
  @IsString()
  @IsOptional()
  COOKIE_SECRET?: string;

  // OAuth settings
  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CALLBACK_URL?: string;

  @IsString()
  @IsOptional()
  FACEBOOK_APP_ID?: string;

  @IsString()
  @IsOptional()
  FACEBOOK_APP_SECRET?: string;

  @IsString()
  @IsOptional()
  FACEBOOK_CALLBACK_URL?: string;

  @IsString()
  @IsOptional()
  GITHUB_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  GITHUB_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  GITHUB_CALLBACK_URL?: string;

  // Email settings
  @IsString()
  @IsOptional()
  SMTP_HOST?: string;

  @IsNumber()
  @IsOptional()
  SMTP_PORT?: number;

  @IsBoolean()
  @IsOptional()
  SMTP_SECURE?: boolean;

  @IsString()
  @IsOptional()
  SMTP_USER?: string;

  @IsString()
  @IsOptional()
  SMTP_PASSWORD?: string;

  @IsString()
  @IsOptional()
  EMAIL_FROM?: string;

  @IsString()
  @IsOptional()
  SUPPORT_EMAIL?: string;

  // Application settings
  @IsString()
  @IsOptional()
  APP_NAME?: string;
}

/**
 * Validates environment variables against the EnvironmentVariables class
 */
export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    console.error('Environment validation errors:');
    errors.forEach((error) => {
      console.error(`Property ${error.property}:`, error.constraints);
    });

    throw new Error(`Environment validation failed: ${errors.toString()}`);
  }

  return validatedConfig;
}

// // src/config/env.validation.ts
// import { plainToClass } from 'class-transformer';
// import {
//   IsEnum,
//   IsNumber,
//   IsOptional,
//   IsString,
//   IsBoolean,
//   IsUrl,
//   validateSync,
//   Min,
//   IsNotEmpty,
//   ValidateIf,
// } from 'class-validator';

// enum Environment {
//   Development = 'development',
//   Production = 'production',
//   Test = 'test',
//   Staging = 'staging',
// }

// class EnvironmentVariables {
//   @IsEnum(Environment)
//   NODE_ENV: Environment;

//   @IsNumber()
//   @IsOptional()
//   @Min(1)
//   PORT?: number;

//   // Database Configuration
//   @IsString()
//   @IsOptional()
//   DATABASE_URL?: string;

//   @ValidateIf((o) => !o.DATABASE_URL)
//   @IsString()
//   @IsNotEmpty()
//   DB_HOST?: string;

//   @ValidateIf((o) => !o.DATABASE_URL)
//   @IsNumber()
//   @IsNotEmpty()
//   DB_PORT?: number;

//   @ValidateIf((o) => !o.DATABASE_URL)
//   @IsString()
//   @IsNotEmpty()
//   DB_USERNAME?: string;

//   @ValidateIf((o) => !o.DATABASE_URL)
//   @IsString()
//   DB_PASSWORD?: string;

//   @ValidateIf((o) => !o.DATABASE_URL)
//   @IsString()
//   @IsNotEmpty()
//   DB_DATABASE?: string;

//   @IsBoolean()
//   @IsOptional()
//   DB_SSL?: boolean;

//   @IsBoolean()
//   @IsOptional()
//   DB_SYNCHRONIZE?: boolean;

//   @IsBoolean()
//   @IsOptional()
//   DB_LOGGING?: boolean;

//   // Redis Configuration
//   @IsString()
//   @IsOptional()
//   REDIS_HOST?: string;

//   @IsNumber()
//   @IsOptional()
//   REDIS_PORT?: number;

//   @IsString()
//   @IsOptional()
//   REDIS_PASSWORD?: string;

//   @IsBoolean()
//   @IsOptional()
//   USE_REDIS?: boolean;

//   // JWT Configuration
//   @IsString()
//   @IsNotEmpty()
//   JWT_SECRET: string;

//   @IsString()
//   @IsOptional()
//   JWT_EXPIRES_IN?: string;

//   // App Configuration
//   @IsString()
//   @IsOptional()
//   APP_NAME?: string;

//   @IsUrl({ require_tld: false })
//   @IsOptional()
//   APP_URL?: string;

//   // Email Configuration
//   @IsBoolean()
//   @IsOptional()
//   EMAIL_ENABLED?: boolean;

//   @ValidateIf((o) => o.EMAIL_ENABLED === true)
//   @IsString()
//   @IsNotEmpty()
//   EMAIL_HOST?: string;

//   @ValidateIf((o) => o.EMAIL_ENABLED === true)
//   @IsNumber()
//   @IsNotEmpty()
//   EMAIL_PORT?: number;

//   @ValidateIf((o) => o.EMAIL_ENABLED === true && o.EMAIL_USE_OAUTH !== true)
//   @IsString()
//   EMAIL_USER?: string;

//   @ValidateIf((o) => o.EMAIL_ENABLED === true && o.EMAIL_USE_OAUTH !== true)
//   @IsString()
//   EMAIL_PASS?: string;

//   @ValidateIf((o) => o.EMAIL_ENABLED === true)
//   @IsNotEmpty()
//   EMAIL_FROM?: string;

//   @IsBoolean()
//   @IsOptional()
//   EMAIL_SECURE?: boolean;

//   @IsBoolean()
//   @IsOptional()
//   EMAIL_USE_OAUTH?: boolean;

//   @IsBoolean()
//   @IsOptional()
//   EMAIL_USE_TEST_ACCOUNT?: boolean;

//   // OAuth Configuration (for Gmail)
//   @ValidateIf((o) => o.EMAIL_ENABLED === true && o.EMAIL_USE_OAUTH === true)
//   @IsString()
//   @IsNotEmpty()
//   GMAIL_CLIENT_ID?: string;

//   @ValidateIf((o) => o.EMAIL_ENABLED === true && o.EMAIL_USE_OAUTH === true)
//   @IsString()
//   @IsNotEmpty()
//   GMAIL_CLIENT_SECRET?: string;

//   @ValidateIf((o) => o.EMAIL_ENABLED === true && o.EMAIL_USE_OAUTH === true)
//   @IsString()
//   @IsNotEmpty()
//   GMAIL_REFRESH_TOKEN?: string;

//   @ValidateIf((o) => o.EMAIL_USE_OAUTH === true)
//   // @IsUrl()
//   // @IsNotEmpty()
//   GMAIL_REDIRECT_URI?: string;

//   // CORS Configuration
//   @IsString()
//   @IsOptional()
//   CORS_ORIGINS?: string;

//   // Security Configuration
//   @IsString()
//   @IsOptional()
//   WEBHOOK_SECRET?: string;

//   @IsNumber()
//   @IsOptional()
//   WEBHOOK_TIMEOUT?: number;

//   // Cache Configuration
//   @IsNumber()
//   @IsOptional()
//   CACHE_TTL?: number;

//   // Rate Limiting
//   @IsNumber()
//   @IsOptional()
//   THROTTLE_TTL?: number;

//   @IsNumber()
//   @IsOptional()
//   THROTTLE_LIMIT?: number;

//   @IsString()
//   @IsOptional()
//   THROTTLER_BYPASS_PATHS?: string;

//   @IsBoolean()
//   @IsOptional()
//   THROTTLER_SKIP_IN_DEV?: boolean;
// }

// export function validate(config: Record<string, unknown>) {
//   // Convert environment variables to the correct types
//   const validatedConfig = plainToClass(EnvironmentVariables, config, {
//     enableImplicitConversion: true,
//   });

//   const errors = validateSync(validatedConfig, {
//     skipMissingProperties: false,
//   });

//   if (errors.length > 0) {
//     console.error('Environment validation failed:');
//     errors.forEach((error) => {
//       console.error(
//         `- ${error.property}: ${Object.values(error.constraints).join(', ')}`,
//       );
//     });
//     throw new Error(`Environment validation failed: ${errors.toString()}`);
//   }

//   return validatedConfig;
// }
