import { SetMetadata } from '@nestjs/common';

export const OrganizationRoles = (...roles: string[]) =>
  SetMetadata('roles', roles);
