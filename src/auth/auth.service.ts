// src/auth/auth.service.ts
import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
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
import { LoginDto, SecurityInfoDto } from './dto/login.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditService } from 'src/audit/audit.service';
import { Request } from 'express';
import { PendingRegistration } from './dto/verify-registration.dto';
import { VerifyRegistrationDto } from './dto/pending-registration.entity';

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
    @InjectRepository(PendingRegistration)
    private pendingRegistrationRepository: Repository<PendingRegistration>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private usersService: UsersService,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditService: AuditService,
    @Inject(EMAIL_SERVICE)
    private emailService: IEmailService,
  ) {}

  // Validate user credentials
  async validateUser(email: string, password: string): Promise<any> {
    console.log('AuthService.validateUser called for:', email);

    try {
      const user = await this.usersRepository.findOne({
        where: { email, isActive: true },
      });

      console.log(
        'User found:',
        user ? `${user.id} (isActive: ${user.isActive})` : 'No user found',
      );

      if (!user) {
        console.log('No active user found with email:', email);
        return null;
      }

      if (!user.password) {
        console.log(
          'User has no password, might be OAuth/Magic Link only account',
        );
        return null;
      }

      const isPasswordValid = await user.comparePassword(password);
      console.log('Password validation result:', isPasswordValid);

      if (isPasswordValid) {
        const { password, ...result } = user;
        return result;
      }

      return null;
    } catch (error) {
      console.error('Error in validateUser:', error.message);
      console.error('Error stack:', error.stack);
      throw error;
    }
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

    // Check if there's already a pending registration
    let pendingRegistration = await this.pendingRegistrationRepository.findOne({
      where: { email: registerDto.email },
    });

    // Generate a 6-digit verification code
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    // Set expiration time (30 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);

    if (pendingRegistration) {
      // Update existing pending registration
      pendingRegistration.password = await bcrypt.hash(
        registerDto.password,
        10,
      );
      pendingRegistration.fullName = registerDto.fullName;
      pendingRegistration.verificationCode = verificationCode;
      pendingRegistration.expiresAt = expiresAt;
      pendingRegistration.attempts = 0;
    } else {
      // Create a new pending registration
      pendingRegistration = this.pendingRegistrationRepository.create({
        email: registerDto.email,
        password: await bcrypt.hash(registerDto.password, 10),
        fullName: registerDto.fullName,
        verificationCode,
        expiresAt,
      });
    }

    await this.pendingRegistrationRepository.save(pendingRegistration);

    // Send verification email with code
    await this.emailService.sendVerificationCode(
      registerDto.email,
      registerDto.fullName,
      verificationCode,
    );

    // Log this action
    await this.auditService.log({
      action: 'registration_initiated',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string,
      metadata: { email: registerDto.email },
    });

    return {
      success: true,
      message:
        'Registration initiated. Please check your email for a verification code.',
    };
  }

  async verifyRegistration(
    verifyDto: VerifyRegistrationDto,
    req: ParsedRequest,
  ): Promise<any> {
    // Find the pending registration
    const pendingRegistration =
      await this.pendingRegistrationRepository.findOne({
        where: { email: verifyDto.email },
      });

    if (!pendingRegistration) {
      throw new NotFoundException(
        'No pending registration found for this email',
      );
    }

    // Check if verification code has expired
    if (pendingRegistration.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Verification code has expired. Please request a new one.',
      );
    }

    // Increment attempts counter
    pendingRegistration.attempts += 1;
    await this.pendingRegistrationRepository.save(pendingRegistration);

    // Check max attempts (5)
    if (pendingRegistration.attempts > 5) {
      throw new UnauthorizedException(
        'Too many failed attempts. Please request a new verification code.',
      );
    }

    // Verify the code
    if (pendingRegistration.verificationCode !== verifyDto.code) {
      throw new UnauthorizedException('Invalid verification code');
    }

    // Create the user
    const user = this.usersRepository.create({
      email: pendingRegistration.email,
      password: pendingRegistration.password, // Already hashed
      fullName: pendingRegistration.fullName,
      emailVerified: true, // Email is verified
    });

    // Set the flag to skip password hashing
    user.skipPasswordHashing = true;

    await this.usersRepository.save(user);

    // Remove pending registration
    await this.pendingRegistrationRepository.delete(pendingRegistration.id);

    // Log this action
    await this.auditService.log({
      action: 'registration_completed',
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string,
    });

    // Create session and JWT
    return this.createSession(user, req);
  }

  // Add method to resend verification code
  async resendVerificationCode(
    email: string,
    req: ParsedRequest,
  ): Promise<any> {
    // Find the pending registration
    const pendingRegistration =
      await this.pendingRegistrationRepository.findOne({
        where: { email },
      });

    if (!pendingRegistration) {
      throw new NotFoundException(
        'No pending registration found for this email',
      );
    }

    // Generate a new verification code
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    // Update expiration time
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);

    // Update pending registration
    pendingRegistration.verificationCode = verificationCode;
    pendingRegistration.expiresAt = expiresAt;
    pendingRegistration.attempts = 0;

    await this.pendingRegistrationRepository.save(pendingRegistration);

    // Send new verification email
    await this.emailService.sendVerificationCode(
      email,
      pendingRegistration.fullName,
      verificationCode,
    );

    // Log this action
    await this.auditService.log({
      action: 'verification_code_resent',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string,
      metadata: { email },
    });

    return {
      success: true,
      message: 'A new verification code has been sent to your email.',
    };
  }

  // Login with email and password
  async login(loginDto: LoginDto, req: ParsedRequest): Promise<any> {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    this.logger.log(
      `Login from device: ${JSON.stringify(loginDto.securityInfo)}`,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.usersRepository.update(user.id, { lastLoginAt: new Date() });

    // Create session and JWT
    const sessionData = await this.createSession(user, req);

    // Emit webhook event
    this.eventEmitter.emit('user.login', {
      userId: user.id,
      email: user.email,
      timestamp: new Date(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return sessionData;
  }

  async sendMagicLink(email: string, req: Request): Promise<void> {
    // Find user or create a pending user
    let user = await this.usersRepository.findOne({ where: { email } });

    if (!user) {
      // Create a pending user
      user = this.usersRepository.create({
        email,
        emailVerified: false,
        roles: ['user'],
      });
      await this.usersRepository.save(user);
    }

    // Create a token that expires in 15 minutes
    const token = await this.createToken(user.id, 'magic_link', 0.25);

    // Send magic link email
    await this.emailService.sendMagicLinkEmail(
      email,
      user.fullName,
      token.token,
    );

    // Log this action
    await this.auditService.log({
      action: 'magic_link_sent',
      userId: user.id,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      metadata: { email },
    });
  }

  // Fix the verifyMagicLink method to work with Express Request
  async verifyMagicLink(
    token: string,
    req: Request,
  ): Promise<{ accessToken: string; refreshToken: string; user: any }> {
    // Find token in database
    const tokenRecord = await this.tokenRepository.findOne({
      where: { token, type: 'magic_link', used: false },
      relations: ['user'],
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired magic link');
    }

    // Mark token as used
    tokenRecord.used = true;
    await this.tokenRepository.save(tokenRecord);

    // Get user
    const user = tokenRecord.user;

    // If email wasn't verified before, verify it now
    if (!user.emailVerified) {
      user.emailVerified = true;
      await this.usersRepository.save(user);
    }

    // Create a parsed request object from Express request
    const parsedReq = {
      ip: req.ip || req.socket.remoteAddress,
      headers: req.headers,
    } as unknown as ParsedRequest;

    // Create session
    const sessionData = await this.createSession(user, parsedReq);

    // Log successful login
    await this.auditService.log({
      action: 'login_magic_link',
      userId: user.id,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'] as string,
    });

    return {
      accessToken: sessionData.accessToken,
      refreshToken: sessionData.refreshToken,
      user: this.sanitizeUser(user),
    };
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

  async findOrCreateOAuthUser(
    oauthData: OAuthUserDto,
    req: Request,
  ): Promise<User> {
    // Check if this OAuth account is already connected
    let oauthConnection = await this.userOAuthRepository.findOne({
      where: {
        provider: oauthData.provider,
        providerId: oauthData.providerId,
      },
      relations: ['user'],
    });

    if (oauthConnection) {
      // Update OAuth token information
      oauthConnection.accessToken = oauthData.accessToken;
      if (oauthData.refreshToken) {
        oauthConnection.refreshToken = oauthData.refreshToken;
      }
      oauthConnection.profile = oauthData.profile;
      await this.userOAuthRepository.save(oauthConnection);

      const user = oauthConnection.user;

      // Log OAuth login
      await this.auditService.log({
        action: `login_oauth_${oauthData.provider}`,
        userId: user.id,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      return user;
    }

    // Check if user with this email exists
    let user = await this.usersRepository.findOne({
      where: { email: oauthData.email },
    });

    // Create new user if needed
    if (!user) {
      user = this.usersRepository.create({
        email: oauthData.email,
        fullName: oauthData.fullName || '',
        avatarUrl: oauthData.avatarUrl,
        emailVerified: true, // OAuth emails are considered verified
        roles: ['user'],
      });

      await this.usersRepository.save(user);

      // Log user creation
      await this.auditService.log({
        action: `register_oauth_${oauthData.provider}`,
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { provider: oauthData.provider },
      });
    }

    // Create OAuth connection
    oauthConnection = this.userOAuthRepository.create({
      provider: oauthData.provider,
      providerId: oauthData.providerId,
      accessToken: oauthData.accessToken,
      refreshToken: oauthData.refreshToken,
      profile: oauthData.profile,
      user,
    });

    await this.userOAuthRepository.save(oauthConnection);

    // Log OAuth connection
    await this.auditService.log({
      action: `connect_oauth_${oauthData.provider}`,
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

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
      userAgent: req.headers['user-agent'] as string,
      ipAddress: typeof req.ip === 'string' ? req.ip : req.ip?.[0] || '',
      device: this.extractDeviceInfo(req.headers['user-agent'] as string),
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
  async refreshToken(refreshToken: string): Promise<any> {
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

  // auth.service.ts - Enhanced session management

  async getSessions(userId: string): Promise<Session[]> {
    return this.sessionRepository.find({
      where: { userId, isActive: true },
      order: { lastActiveAt: 'DESC' },
    });
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    session.isActive = false;
    await this.sessionRepository.save(session);

    // Log session revocation
    await this.auditService.log({
      action: 'session_revoked',
      userId,
      metadata: { sessionId },
    });
  }

  async revokeAllSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<void> {
    // Keep the current session active if provided
    const query: any = { userId, isActive: true };

    if (currentSessionId) {
      query.id = Not(currentSessionId);
    }

    await this.sessionRepository.update(query, {
      isActive: false,
    });

    // Log all sessions revocation
    await this.auditService.log({
      action: 'all_sessions_revoked',
      userId,
      metadata: { excludedSessionId: currentSessionId },
    });
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

  private sanitizeUser(user: User): any {
    const { ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async forgotPassword(email: string, req: ParsedRequest): Promise<void> {
    // Tìm kiếm người dùng
    const user = await this.usersRepository.findOne({ where: { email } });

    // Ngay cả khi không tìm thấy người dùng, vẫn trả về thành công để tránh tiết lộ thông tin
    if (!user) {
      this.logger.log(
        `Forgot password request for non-existent email: ${email}`,
      );
      return;
    }

    // Kiểm tra nếu tài khoản bị khóa
    if (!user.isActive) {
      this.logger.log(`Forgot password request for inactive account: ${email}`);
      return;
    }

    // Tạo token đặt lại mật khẩu có thời hạn 1 giờ
    const token = await this.createToken(user.id, 'password_reset', 1);

    // Gửi email chứa liên kết đặt lại mật khẩu
    await this.emailService.sendPasswordResetEmail(
      user.email,
      user.fullName,
      token.token,
    );

    // Ghi nhật ký hành động này
    await this.auditService.log({
      action: 'password_reset_requested',
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string,
    });
  }

  // Thêm phương thức để đặt lại mật khẩu
  async resetPassword(
    req: ParsedRequest,
    token: string,
    newPassword: string,
    securityInfo?: SecurityInfoDto,
  ): Promise<void> {
    // Tìm token trong cơ sở dữ liệu
    const tokenRecord = await this.tokenRepository.findOne({
      where: { token, type: 'password_reset', used: false },
      relations: ['user'],
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    // Đánh dấu token đã sử dụng
    tokenRecord.used = true;
    await this.tokenRepository.save(tokenRecord);

    // Lấy thông tin người dùng
    const user = tokenRecord.user;

    // Kiểm tra người dùng có hoạt động không
    if (!user.isActive) {
      throw new UnauthorizedException('User account is locked or inactive');
    }

    // Cập nhật mật khẩu
    user.password = newPassword;
    await this.usersRepository.save(user);

    // Vô hiệu hóa tất cả các phiên hiện tại của người dùng
    await this.revokeAllSessions(user.id);

    this.logger.log(
      `Resset password from device: ${JSON.stringify(securityInfo)}`,
    );

    // Ghi nhật ký hành động này
    await this.auditService.log({
      action: 'password_reset_completed',
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string,
    });
  }

  // Sửa phương thức adminChangeUserPassword
  async adminChangeUserPassword(
    adminId: string,
    userId: string,
    newPassword: string,
  ): Promise<void> {
    // Tìm admin
    const admin = await this.usersRepository.findOne({
      where: { id: adminId },
    });

    if (
      !admin ||
      !admin.roles.some((role) => ['admin', 'superadmin'].includes(role))
    ) {
      throw new UnauthorizedException('Insufficient permissions');
    }

    // Tìm người dùng cần thay đổi mật khẩu
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Kiểm tra quyền: admin không thể thay đổi mật khẩu của admin hoặc superadmin khác
    if (user.roles.includes('admin') || user.roles.includes('superadmin')) {
      if (!admin.roles.includes('superadmin')) {
        throw new UnauthorizedException(
          'Cannot change password of an admin or superadmin',
        );
      }
    }

    // Cập nhật mật khẩu
    user.password = newPassword;
    await this.usersRepository.save(user);

    // Ghi nhật ký hành động này
    await this.auditService.log({
      action: 'admin_changed_user_password',
      userId: adminId,
      metadata: { targetUserId: userId }, // Sửa: đặt targetUserId vào metadata
    });
  }

  // Sửa phương thức changeAccountStatus
  async changeAccountStatus(
    adminId: string,
    userId: string,
    isActive: boolean,
  ): Promise<void> {
    // Tìm admin
    const admin = await this.usersRepository.findOne({
      where: { id: adminId },
    });

    if (
      !admin ||
      !admin.roles.some((role) => ['admin', 'superadmin'].includes(role))
    ) {
      throw new UnauthorizedException('Insufficient permissions');
    }

    // Tìm người dùng cần thay đổi trạng thái
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Kiểm tra quyền: admin không thể khóa tài khoản của admin hoặc superadmin khác
    if (user.roles.includes('admin') || user.roles.includes('superadmin')) {
      if (!admin.roles.includes('superadmin')) {
        throw new UnauthorizedException(
          'Cannot change status of an admin or superadmin',
        );
      }
    }

    // Cập nhật trạng thái tài khoản
    user.isActive = isActive;
    await this.usersRepository.save(user);

    // Nếu khóa tài khoản, vô hiệu hóa tất cả các phiên
    if (!isActive) {
      await this.revokeAllSessions(user.id);
    }

    // Ghi nhật ký hành động này
    await this.auditService.log({
      action: isActive ? 'account_unlocked' : 'account_locked',
      userId: adminId,
      metadata: { targetUserId: userId }, // Sửa: đặt targetUserId vào metadata
    });
  }
}
