// src/auth/strategies/jwt.strategy.ts
import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Lấy token từ Authorization header
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // Lấy token từ cookie
        (request: Request) => {
          if (request.cookies && request.cookies.accessToken) {
            return request.cookies.accessToken;
          }
          return null;
        },
        // Lấy token từ query params
        ExtractJwt.fromUrlQueryParameter('token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      passReqToCallback: true,
    });

    // Ghi log cho mục đích debug
    this.logger.log(
      `JWT strategy initialized with secret: ${configService.get<string>('JWT_SECRET') ? '******' : 'undefined'}`,
    );
  }

  async validate(request: Request, payload: any) {
    this.logger.debug(`JWT payload: ${JSON.stringify(payload)}`);
    return {
      userId: payload.sub,
      email: payload.email,
      roles: payload.roles,
      sessionId: payload.sessionId,
    };
  }
}
