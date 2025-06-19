// src/auth/two-factor/two-factor.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TwoFactorController } from './two-factor.controller';
import { TwoFactorService } from './two-factor.service';
import { TwoFactorAuth } from './entities/two-factor.entity';
import { User } from '../users/entities/user.entity';
import { EmailModule } from '../email/email.module';
import { AuditModule } from 'src/audit/audit.module';
import { Session } from 'src/users/entities/session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TwoFactorAuth, User, Session]),
    AuditModule,
    forwardRef(() => EmailModule),
  ],
  controllers: [TwoFactorController],
  providers: [TwoFactorService],
  exports: [TwoFactorService],
})
export class TwoFactorModule {}
