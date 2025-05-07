// src/auth/auth.service.ts
import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { EMAIL_SERVICE } from '../email/email.di-token';
import { IEmailService } from '../email/email.port';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { RegisterDto } from './dto/register.dto';
import { UserOAuth } from 'src/users/entities/user-oauth.entity';
import { Token } from 'src/users/entities/token.entity';
import { Session } from 'src/users/entities/session.entity';
import { UsersService } from 'src/users/user.service';
import { ParsedRequest } from './interfaces/parsed-request.interface';
import { OAuthUserDto } from './dto/oauth-user.dto';
import { MagicLinkDto } from './dto/magic-link.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(UserOAuth)
    private userOAuthRepository: Repository<UserOAuth>,
    @InjectRepository(Token)
    private tokenRepository: Repository<Token>,
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private usersService: UsersService,
    @Inject(EMAIL_SERVICE)
    private emailService: IEmailService,
  ) {}

  // Validate user credentials
  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersRepository.findOne({
      where: { email, isActive: true },
    });
    if (
      user &&
      user.password &&
      (await bcrypt.compare(password, user.password))
    ) {
      const { ...result } = user;
      return result;
    }
    return null;
  }

  // Register a new user
  async register(registerDto: RegisterDto, req: ParsedRequest): Promise<any> {
    // Check if user already exists
    const existingUser = await this.usersRepository.findOne({
      where: { email: registerDto.email },
    });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Create new user
    const user = this.usersRepository.create({
      email: registerDto.email,
      password: registerDto.password,
      fullName: registerDto.fullName,
    });

    await this.usersRepository.save(user);

    // Create verification token
    const token = await this.createToken(user.id, 'email_verification', 24); // 24 hours

    // Send verification email
    await this.emailService.sendVerificationEmail(
      user.email,
      user.fullName,
      token.token,
    );

    // Create session and JWT
    return this.createSession(user, req);
  }

  // Login with email and password
  async login(loginDto: LoginDto, req: ParsedRequest): Promise<any> {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.usersRepository.update(user.id, { lastLoginAt: new Date() });

    // Create session and JWT
    return this.createSession(user, req);
  }

  // Send magic link email
  async sendMagicLink(magicLinkDto: MagicLinkDto): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { email: magicLinkDto.email, isActive: true },
    });

    if (!user) {
      // Don't reveal that user doesn't exist
      return;
    }

    // Create token
    const token = await this.createToken(user.id, 'magic_link', 1); // 1 hour

    // Create magic link
    const magicLink = `${this.configService.get('APP_URL')}/auth/verify-magic-link/${token.token}`;

    // Send magic link email (you'll need to create this template)
    await this.emailService.queueEmail(
      user.email,
      'Sign in to your account',
      'magic-link',
      {
        name: user.fullName || 'User',
        magicLink,
      },
    );
  }

  // Verify magic link token
  async verifyMagicLink(token: string, req: ParsedRequest): Promise<any> {
    const tokenRecord = await this.tokenRepository.findOne({
      where: { token, type: 'magic_link', used: false },
      relations: ['user'],
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Mark token as used
    tokenRecord.used = true;
    await this.tokenRepository.save(tokenRecord);

    // Update last login
    await this.usersRepository.update(tokenRecord.user.id, {
      lastLoginAt: new Date(),
    });

    // Create session and JWT
    return this.createSession(tokenRecord.user, req);
  }

  // Verify email
  async verifyEmail(token: string): Promise<any> {
    const tokenRecord = await this.tokenRepository.findOne({
      where: { token, type: 'email_verification', used: false },
      relations: ['user'],
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Mark token as used
    tokenRecord.used = true;
    await this.tokenRepository.save(tokenRecord);

    // Verify user's email
    await this.usersRepository.update(tokenRecord.user.id, {
      emailVerified: true,
    });

    return { success: true, message: 'Email verified successfully' };
  }

  // Find or create OAuth user
  async findOrCreateOAuthUser(oauthUserDto: OAuthUserDto): Promise<User> {
    // Check if this OAuth account is already connected to a user
    let oauthConnection = await this.userOAuthRepository.findOne({
      where: {
        provider: oauthUserDto.provider,
        providerId: oauthUserDto.providerId,
      },
      relations: ['user'],
    });

    if (oauthConnection) {
      // Update OAuth connection
      oauthConnection.accessToken = oauthUserDto.accessToken;
      oauthConnection.refreshToken =
        oauthUserDto.refreshToken || oauthConnection.refreshToken;
      oauthConnection.profile = oauthUserDto.profile;
      await this.userOAuthRepository.save(oauthConnection);

      return oauthConnection.user;
    }

    // Check if user with this email exists
    let user = await this.usersRepository.findOne({
      where: { email: oauthUserDto.email },
    });

    if (!user) {
      // Create new user
      user = this.usersRepository.create({
        email: oauthUserDto.email,
        fullName: oauthUserDto.fullName,
        avatarUrl: oauthUserDto.avatarUrl,
        emailVerified: true, // Email is verified by OAuth provider
      });

      await this.usersRepository.save(user);
    }

    // Create OAuth connection
    oauthConnection = this.userOAuthRepository.create({
      provider: oauthUserDto.provider,
      providerId: oauthUserDto.providerId,
      accessToken: oauthUserDto.accessToken,
      refreshToken: oauthUserDto.refreshToken,
      profile: oauthUserDto.profile,
      userId: user.id,
    });

    await this.userOAuthRepository.save(oauthConnection);

    return user;
  }

  // Create token for verification, password reset, etc.
  private async createToken(
    userId: string,
    type: string,
    expiresInHours: number,
  ): Promise<Token> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    const token = this.tokenRepository.create({
      userId,
      type,
      expiresAt,
    });

    return this.tokenRepository.save(token);
  }

  // Create a new session for a user
  private async createSession(user: User, req: ParsedRequest): Promise<any> {
    // Calculate expiration for access token
    const jwtExpiresInSeconds = parseInt(
      this.configService.get('JWT_EXPIRES_IN', '3600'),
    );

    // Calculate expiration for refresh token (30 days)
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 30);

    const accessTokenExpiresAt = new Date(
      Date.now() + jwtExpiresInSeconds * 1000,
    );

    // Generate refresh token
    const refreshToken = this.generateRefreshToken();

    // Create session record
    const session = this.sessionRepository.create({
      userId: user.id,
      token: uuidv4(),
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      device: this.extractDeviceInfo(req.headers['user-agent']),
      expiresAt: refreshExpiresAt,
      lastActiveAt: new Date(),
      refreshToken,
      refreshTokenExpiresAt: refreshExpiresAt,
    });

    await this.sessionRepository.save(session);

    // Create JWT payload
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      sessionId: session.id,
      roles: user.roles,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        emailVerified: user.emailVerified,
        roles: user.roles,
      },
      accessToken,
      refreshToken,
      expiresAt: Math.floor(accessTokenExpiresAt.getTime() / 1000), // Convert to seconds
      refreshExpiresAt: Math.floor(refreshExpiresAt.getTime() / 1000), // Convert to seconds
    };
  }

  // Add a method to refresh the access token
  async refreshToken(refreshToken: string, req: ParsedRequest): Promise<any> {
    // Find the session with this refresh token
    const session = await this.sessionRepository.findOne({
      where: {
        refreshToken,
        isActive: true,
      },
      relations: ['user'],
    });

    if (!session || session.refreshTokenExpiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Check if the user is still active
    const user = await this.usersRepository.findOne({
      where: {
        id: session.userId,
        isActive: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User account is not active');
    }

    // Generate a new set of tokens
    // Calculate expiration for access token
    const jwtExpiresInSeconds = parseInt(
      this.configService.get('JWT_EXPIRES_IN', '3600'),
    );

    const accessTokenExpiresAt = new Date(
      Date.now() + jwtExpiresInSeconds * 1000,
    );

    // Create JWT payload
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      sessionId: session.id,
      roles: user.roles,
    };

    const accessToken = this.jwtService.sign(payload);

    // Update the last active timestamp
    session.lastActiveAt = new Date();
    await this.sessionRepository.save(session);

    return {
      accessToken,
      expiresAt: Math.floor(accessTokenExpiresAt.getTime() / 1000), // Convert to seconds
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        emailVerified: user.emailVerified,
        roles: user.roles,
      },
    };
  }

  private generateRefreshToken(): string {
    return uuidv4(); // Using UUID for refresh tokens
  }

  // Extract device info from user agent
  private extractDeviceInfo(userAgent: string): string {
    if (!userAgent) return 'Unknown';

    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('iPad')) return 'iPad';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Macintosh')) return 'Mac';
    if (userAgent.includes('Linux')) return 'Linux';

    return 'Unknown';
  }

  // In your AuthService, add a method to check session status
  async checkSessionStatus(refreshToken: string): Promise<any> {
    const session = await this.sessionRepository.findOne({
      where: { refreshToken },
    });

    return {
      exists: !!session,
      isActive: session?.isActive,
      expired: session ? session.refreshTokenExpiresAt < new Date() : true,
      expiresAt: session?.refreshTokenExpiresAt,
    };
  }

  async invalidateSession(sessionId: string): Promise<void> {
    await this.sessionRepository.update(
      { id: sessionId },
      {
        isActive: false,
        updatedAt: new Date(),
      },
    );
  }
}
