// src/admin/admin.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import {
  AdminUserController,
  EmailTemplateController,
} from './admin.controller';
import { UsersModule } from 'src/users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from 'src/users/entities/session.entity';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailModule } from 'src/email/email.module';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    forwardRef(() => AuditModule),
    TypeOrmModule.forFeature([Session]),
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
    forwardRef(() => AuthModule),
    EmailModule,
  ],
  controllers: [AdminUserController, EmailTemplateController],
  providers: [
    // Thêm các guard vào providers để đảm bảo chúng có sẵn
    {
      provide: JwtAuthGuard,
      useClass: JwtAuthGuard,
    },
    {
      provide: AdminGuard,
      useClass: AdminGuard,
    },
  ],
})
export class AdminModule {}
