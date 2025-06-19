// src/auth/auth.module.ts
import { forwardRef, Logger, Module, OnModuleInit } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { FacebookStrategy } from './strategies/facebook.strategy';
import { GitHubStrategy } from './strategies/github.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { User } from '../users/entities/user.entity';
import { UserOAuth } from 'src/users/entities/user-oauth.entity';
import { Token } from 'src/users/entities/token.entity';
import { Session } from 'src/users/entities/session.entity';
import { UsersService } from 'src/users/user.service';
import { EmailModule } from 'src/email/email.module';
import { AuditModule } from 'src/audit/audit.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MagicLinkService } from './magic-link.service';
import { PasswordPolicyService } from './password-policy.service';
import { AccountLockoutService } from './account-lockout.service';
import { PendingRegistration } from './dto/verify-registration.dto';
import { UsersModule } from 'src/users/users.module';
import { TwoFactorModule } from 'src/two-factor/two-factor.module';
import { ModuleRef } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '1h'),
        },
      }),
    }),
    TypeOrmModule.forFeature([
      User,
      UserOAuth,
      Token,
      Session,
      PendingRegistration,
    ]),
    ConfigModule,
    forwardRef(() => EmailModule),
    AuditModule,
    EventEmitterModule.forRoot(),
    forwardRef(() => TwoFactorModule),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: 'GLOBAL_JWT_SERVICE',
      useFactory: (moduleRef: ModuleRef) => {
        const jwtService = moduleRef.get(JwtService, { strict: false });
        return jwtService;
      },
      inject: [ModuleRef],
    },
    AuthService,
    UsersService,
    JwtStrategy,
    LocalStrategy,
    GoogleStrategy,
    FacebookStrategy,
    GitHubStrategy,
    JwtAuthGuard,
    AdminGuard,
    MagicLinkService,
    PasswordPolicyService,
    AccountLockoutService,
  ],
  exports: [
    AuthService,
    JwtModule,
    JwtAuthGuard,
    AdminGuard,
    'GLOBAL_JWT_SERVICE',
  ],
})
export class AuthModule implements OnModuleInit {
  private readonly logger = new Logger(AuthModule.name);

  constructor(private moduleRef: ModuleRef) {}

  onModuleInit() {
    // Kiểm tra xem JwtService đã được khởi tạo đúng cách chưa
    try {
      const jwtService = this.moduleRef.get(JwtService);
      this.logger.log('JwtService initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize JwtService: ${error.message}`);
    }
  }
}
