// src/auth/guards/admin.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Kiểm tra nếu người dùng đã được xác thực bởi JwtAuthGuard
    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Kiểm tra nếu người dùng có vai trò admin hoặc superadmin
    if (
      !user.roles ||
      (!user.roles.includes('admin') && !user.roles.includes('superadmin'))
    ) {
      throw new UnauthorizedException('Insufficient permissions');
    }

    return true;
  }
}
