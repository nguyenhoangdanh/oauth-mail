// src/auth/guards/jwt-auth.guard.ts
import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from 'src/users/entities/session.entity';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuditService } from 'src/audit/audit.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Reflector } from '@nestjs/core';
import { ModuleRef } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private jwtService: JwtService;

  constructor(
    private moduleRef: ModuleRef,
    private configService: ConfigService,
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
    private auditService: AuditService,
    private reflector: Reflector,
  ) {
    super();
    // Lazy-load JwtService để tránh circular dependency
    setTimeout(() => {
      this.jwtService = this.moduleRef.get(JwtService, { strict: false });
    }, 0);
  }

  private extractTokenFromRequest(request: Request): string | undefined {
    // Check for cookie first (given precedence)
    if (request.cookies && request.cookies.accessToken) {
      // Log for debugging
      console.log('Found token in cookies');
      return request.cookies.accessToken;
    }

    // Then check Authorization header
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.split(' ')[0] === 'Bearer') {
      console.log('Found token in Authorization header');
      return authHeader.split(' ')[1];
    }

    return undefined;
  }

  // And update your canActivate method
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If public, allow access without authentication
    if (isPublic) {
      return true;
    }

    // Extract and verify JWT from request
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromRequest(request);

    if (!token) {
      this.logger.debug('No JWT token found in request');
      return super.canActivate(context) as Promise<boolean>;
    }

    try {
      // Ensure JwtService is loaded - wait if necessary
      if (!this.jwtService) {
        this.logger.debug('JwtService not yet loaded, waiting...');
        // Retry getting JwtService if it's not loaded yet
        this.jwtService = this.moduleRef.get(JwtService, { strict: false });

        if (!this.jwtService) {
          this.logger.error('JwtService still undefined after retry');
          throw new UnauthorizedException('Authentication service unavailable');
        }
      }

      // Now we can use the JwtService
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // Set user in request
      request.user = payload;

      // Validate session if needed
      if (payload && payload.sessionId) {
        const session = await this.sessionRepository.findOne({
          where: {
            id: payload.sessionId,
            isActive: true,
          },
        });

        if (!session) {
          throw new UnauthorizedException('Session is invalid or expired');
        }

        // Update the last active timestamp
        session.lastActiveAt = new Date();
        await this.sessionRepository.save(session);
      }

      return true;
    } catch (error) {
      this.logger.error(`JWT verification failed: ${error.message}`);
      throw new UnauthorizedException('Invalid authentication token');
    }
  }

  handleRequest(err, user) {
    // Nếu có lỗi hoặc không có user
    if (err || !user) {
      // Log chi tiết hơn
      console.error(
        'Authentication failed:',
        err || 'No user returned from strategy',
      );
      throw err || new UnauthorizedException('Authentication failed');
    }

    return user;
  }
}
