// Updated magic-link.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entities/user.entity';
import { Token } from '../users/entities/token.entity';
import { Session } from '../users/entities/session.entity';
import { EmailService } from '../email/email.service';
import { AuditService } from '../audit/audit.service';
import * as crypto from 'crypto';

@Injectable()
export class MagicLinkService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Token)
    private tokenRepository: Repository<Token>,
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
    private jwtService: JwtService,
    private emailService: EmailService,
    private auditService: AuditService,
  ) {}

  async sendMagicLink(
    email: string,
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { email, isActive: true },
    });

    if (!user) {
      // Don't reveal user existence, still return success
      return;
    }

    // Generate magic link token
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minute validity

    const magicToken = this.tokenRepository.create({
      type: 'magic_link',
      userId: user.id,
      expiresAt,
      used: false,
    });

    await this.tokenRepository.save(magicToken);

    // Send magic link email
    await this.emailService.queueEmail(
      user.email,
      'Your Magic Login Link',
      'magic-link',
      {
        name: user.fullName,
        magicLink: `${process.env.FRONTEND_URL}/auth/magic-link?token=${magicToken.token}`,
        expirationMinutes: 10,
      },
      { priority: 'high' }, // Fix: Use an object with priority instead of a number
    );

    // Log to audit
    await this.auditService.log({
      action: 'magic_link_requested',
      userId: user.id,
      ipAddress: ip,
      userAgent,
    });
  }

  async verifyMagicLink(
    token: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: any;
    expiresAt: number;
    refreshTokenExpiresAt: number;
  }> {
    // Updated return type
    const magicToken = await this.tokenRepository.findOne({
      where: {
        token,
        type: 'magic_link',
        used: false,
        expiresAt: MoreThan(new Date()),
      },
      relations: ['user'],
    });

    if (!magicToken) {
      throw new UnauthorizedException('Invalid or expired magic link');
    }

    const user = magicToken.user;

    // Mark token as used
    magicToken.used = true;
    await this.tokenRepository.save(magicToken);

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    // Create a new session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days session expiry

    const refreshToken = crypto.randomBytes(40).toString('hex');

    const session = this.sessionRepository.create({
      userId: user.id,
      token: crypto.randomBytes(20).toString('hex'),
      ipAddress: ip,
      userAgent: userAgent,
      isActive: true,
      expiresAt: expiresAt,
      refreshToken: refreshToken,
      refreshTokenExpiresAt: expiresAt,
    });

    await this.sessionRepository.save(session);

    // Log to audit
    await this.auditService.log({
      action: 'login_magic_link',
      userId: user.id,
      ipAddress: ip,
      userAgent,
    });

    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      sessionId: session.id,
    };

    // Return user information as well
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: refreshToken,
      expiresAt: Math.floor(session.expiresAt.getTime() / 1000), // Convert to seconds
      refreshTokenExpiresAt: Math.floor(
        session.refreshTokenExpiresAt.getTime() / 1000,
      ), // Convert to seconds
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        emailVerified: user.emailVerified,
        roles: user.roles,
      },
    };
  }
}
