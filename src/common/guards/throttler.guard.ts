// // src/common/guards/throttler.guard.ts
// import { Injectable } from '@nestjs/common';
// import { ThrottlerGuard } from '@nestjs/throttler';
// import { ExecutionContext } from '@nestjs/common';

// @Injectable()
// export class CustomThrottlerGuard extends ThrottlerGuard {
//   getRequestResponse(context: ExecutionContext) {
//     const req = context.switchToHttp().getRequest();
//     const res = context.switchToHttp().getResponse();
//     return { req, res };
//   }

//   protected getTracker(req: Record<string, any>): string {
//     // Use forwarded for if using a reverse proxy
//     return req.ips.length ? req.ips[0] : req.ip;
//   }
// }

// src/common/guards/throttler.guard.ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerException,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  constructor(
    private readonly configService: ConfigService,
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.shouldBypassThrottling(context)) {
      return true;
    }

    try {
      return await super.canActivate(context);
    } catch (error) {
      if (error instanceof ThrottlerException) {
        throw new ThrottlerException(this.getCustomThrottleMessage(context));
      }
      throw error;
    }
  }

  private getIp(req: Record<string, any>): string {
    return (
      req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      req.headers['x-real-ip']?.toString() ||
      req.ip ||
      '0.0.0.0'
    );
  }

  private shouldBypassThrottling(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // 1. Bỏ qua throttling cho health check và các endpoint không quan trọng
    const bypassPaths = this.configService
      .get<string>('THROTTLER_BYPASS_PATHS', '/health,/metrics,/api-docs')
      .split(',');

    if (bypassPaths.some((path) => request.path.includes(path))) {
      return true;
    }

    // 2. Bỏ qua throttling cho admin và các vai trò đặc biệt
    const adminRoles = this.configService
      .get<string>('ADMIN_ROLES', 'admin,superadmin')
      .split(',');

    if (
      request.user &&
      'roles' in request.user &&
      Array.isArray(request.user.roles)
    ) {
      const hasAdminRole = request.user.roles.some((role) =>
        adminRoles.includes(String(role)),
      );
      if (hasAdminRole) {
        return true;
      }
    }

    // 3. Bỏ qua throttling trong môi trường development
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const skipInDev =
      this.configService.get<string>('THROTTLER_SKIP_IN_DEV', 'true') ===
      'true';
    if (nodeEnv === 'development' && skipInDev) {
      return true;
    }

    return false;
  }

  private getCustomThrottleMessage(context: ExecutionContext): string {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path;

    return `Quá nhiều yêu cầu gửi đến ${path}. Vui lòng thử lại sau.`;
  }
}
