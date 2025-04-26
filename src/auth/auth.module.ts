// src/auth/auth.module.ts
import { forwardRef, Module } from '@nestjs/common';
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

@Module({
  imports: [
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
    TypeOrmModule.forFeature([User, UserOAuth, Token, Session]),
    ConfigModule,
    forwardRef(() => EmailModule),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    UsersService,
    JwtStrategy,
    LocalStrategy,
    GoogleStrategy,
    FacebookStrategy,
    GitHubStrategy,
    JwtAuthGuard,
    AdminGuard,
  ],
  exports: [AuthService, JwtModule, JwtAuthGuard, AdminGuard],
})
export class AuthModule {}
