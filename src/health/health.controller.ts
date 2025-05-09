// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';

@Controller('health')
export class HealthController {
  constructor(private health: HealthCheckService) {}

  @Get()
  @SkipThrottle() // Skip rate limiting for health checks
  @HealthCheck()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'api',
      version: process.env.npm_package_version || '1.0.0',
    };
  }
}
