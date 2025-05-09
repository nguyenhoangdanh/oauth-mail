// organization-role.guard.ts

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationsService } from 'src/organizations/organizations.service';

@Injectable()
export class OrganizationRoleGuard implements CanActivate {
  constructor(
    private organizationsService: OrganizationsService,
    private reflector: Reflector,
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
    const organizationId = request.params.id || request.body.organizationId;

    if (!organizationId) {
      return false; // No organization ID provided
    }

    // Check if user has the required role
    return this.organizationsService.checkUserPermission(
      organizationId,
      user.sub,
      requiredRoles,
    );
  }
}
