// src/auth/guards/jwt-auth.guard.ts
import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from 'src/users/entities/session.entity';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private jwtService: JwtService,
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // First, check JWT is valid
    const canActivate = await super.canActivate(context);
    if (!canActivate) {
      return false;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Validate that the session exists and is active
    if (user && user.sessionId) {
      const session = await this.sessionRepository.findOne({
        where: {
          id: user.sessionId,
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
  }

  handleRequest(err, user) {
    // Throw an exception if authentication failed
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication failed');
    }
    return user;
  }
}
