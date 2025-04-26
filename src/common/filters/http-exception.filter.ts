// src/common/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  message: any;
  error?: string;
  code?: string;
  details?: any;
  stack?: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  private readonly isProduction: boolean;

  constructor(private readonly configService?: ConfigService) {
    this.isProduction =
      configService?.get('NODE_ENV') === 'production' || false;
  }

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Determine the status code
    let status: number;
    let message: any;
    let errorCode: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.getResponse();

      // Extract error code if available
      if (typeof message === 'object' && message.code) {
        errorCode = message.code;
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      };

      // Log the full error for server-side debugging
      this.logger.error(
        `Unhandled exception: ${request.method} ${request.url}`,
        exception.stack,
      );
    }

    // Build standardized error response
    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: typeof message === 'object' ? message : { error: message },
    };

    // Add error code if available
    if (errorCode) {
      errorResponse.code = errorCode;
    }

    // Add stack trace in non-production environments
    if (!this.isProduction && exception.stack) {
      errorResponse.stack = exception.stack;
    }

    // Log detailed info for non-200 status codes
    if (status !== HttpStatus.OK) {
      this.logger.error(
        `${request.method} ${request.url} - Status ${status} - ${
          typeof message === 'object' ? JSON.stringify(message) : message
        }`,
        this.isProduction ? null : exception.stack,
      );
    }

    // Return standardized error response
    response.status(status).json(errorResponse);
  }
}
