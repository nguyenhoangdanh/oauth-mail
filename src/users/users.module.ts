// users.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './user.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { Session } from './entities/session.entity';
import { Token } from './entities/token.entity';
import { UserOAuth } from './entities/user-oauth.entity';
import { AuditModule } from '../audit/audit.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Session, Token, UserOAuth]),
    AuditModule,
    // Thêm JwtModule
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN', '1h'),
        },
      }),
    }),
    // Import AuthModule để sử dụng AdminGuard nhưng tránh circular dependency
    forwardRef(() => AuthModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
