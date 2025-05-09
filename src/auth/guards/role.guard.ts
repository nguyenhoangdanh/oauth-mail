// role.guard.ts

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );

    if (!requiredRoles) {
      return true; // No roles required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    const hasRequiredRole = requiredRoles.some((role) =>
      user.roles?.includes(role),
    );

    if (!hasRequiredRole) {
      // Log this access attempt
      await this.auditService.log({
        action: 'permission_denied',
        userId: user.sub,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: {
          requiredRoles,
          path: request.path,
          method: request.method,
        },
      });

      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}

// roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { AuditService } from 'src/audit/audit.service';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

// Usage example:
// @UseGuards(JwtAuthGuard, RoleGuard)
// @Roles('admin')
// @Get('admin-only-endpoint')
// adminOnly() {
//   return 'Only admins can see this';
// }
