// src/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Req,
  Res,
  Param,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Delete,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { GetUser } from './decorators/get-user.decorator';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { MagicLinkDto } from './dto/magic-link.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { MagicLinkService } from './magic-link.service';
import {
  ResendVerificationCodeDto,
  VerifyRegistrationDto,
} from './dto/pending-registration.entity';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgetPasswordDto } from './dto/forget-password.dto';
import { UsersService } from 'src/users/user.service';
import { Public } from './decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
    private magicLinkService: MagicLinkService,
    private readonly usersService: UsersService,
  ) {}

  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
  })
  @Post('register')
  async register(@Body() registerDto: RegisterDto, @Req() req) {
    return this.authService.register(registerDto, req);
  }

  // In your auth.controller.ts or a separate debug controller
  @Get('debug-cors')
  async debugCors(@Req() req, @Res({ passthrough: true }) res: Response) {
    console.log('Debug CORS endpoint called');
    console.log('Headers:', req.headers);
    return { success: true, message: 'CORS is working' };
  }

  @Get('debug-cookies')
  async debugCookies(@Req() req, @Res({ passthrough: true }) res: Response) {
    console.log('Debug cookies endpoint called');
    console.log('Cookies from request:', req.cookies);

    // Thiết lập một cookie test
    res.cookie('test-cookie', 'works', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60000,
      path: '/',
    });

    return {
      success: true,
      message: 'Test cookie set',
      cookies: req.cookies,
    };
  }

  @ApiOperation({ summary: 'Verify registration with code' })
  @ApiResponse({
    status: 200,
    description: 'User registered and logged in successfully',
  })
  @Post('verify-registration')
  async verifyRegistration(
    @Body() verifyDto: VerifyRegistrationDto,
    @Req() req,
  ) {
    return this.authService.verifyRegistration(verifyDto, req);
  }

  @ApiOperation({ summary: 'Resend verification code' })
  @ApiResponse({
    status: 200,
    description: 'New verification code sent',
  })
  @Post('resend-verification-code')
  async resendVerificationCode(
    @Body() resendDto: ResendVerificationCodeDto,
    @Req() req,
  ) {
    return this.authService.resendVerificationCode(resendDto.email, req);
  }

  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiResponse({
    status: 200,
    description: 'User logged in successfully',
  })
  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Req() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, expiresAt, refreshExpiresAt, user } =
      await this.authService.login(loginDto, req);

    // Set HTTP-only cookie with the access token
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      // secure: true,
      // sameSite: 'none',
      maxAge: expiresAt * 1000,
      path: '/', // Set path to root
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      // secure: true,
      // sameSite: 'none',
      maxAge: refreshExpiresAt * 1000,
      path: '/', // Set path to root instead of '/auth/refresh-token'
    });

    return {
      success: true,
      user,
      accessToken,
      refreshToken, // Include this in the response only once during login
      expiresAt,
    };
  }

  @Get('verify-auth')
  async verifyAuth(@Req() req) {
    try {
      // The JwtAuthGuard will verify the token from cookies
      // If we get here, the token is valid
      return {
        authenticated: true,
        // Return minimal user info
        user: {
          id: req.user.sub,
          email: req.user.email,
          roles: req.user.roles || [],
        },
      };
    } catch (error) {
      console.log('error', error);
      return { authenticated: false };
    }
  }

  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
  })
  @Post('refresh-token')
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, expiresAt, user } =
      await this.authService.refreshToken(refreshTokenDto.refreshToken);

    // Set HTTP-only cookie with the new token
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: expiresAt * 1000, // Convert seconds to milliseconds
    });

    return {
      success: true,
      user,
      accessToken,
      expiresAt,
    };
  }

  @ApiOperation({ summary: 'Refresh access token using cookie' })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
  })
  @Post('refresh')
  async refreshFromCookie(
    @Req() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      req.cookies?.refreshToken ||
      req.body?.refreshToken ||
      req.headers['x-refresh-token'];

    console.log('Refresh token present:', !!refreshToken);
    // Get refresh token from cookie
    // const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const { accessToken, expiresAt, user } =
      await this.authService.refreshToken(refreshToken);

    // Set HTTP-only cookie with the new token
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: expiresAt * 1000, // Convert seconds to milliseconds
    });

    return {
      success: true,
      user,
      accessToken,
      expiresAt,
    };
  }

  // @ApiOperation({ summary: 'Send a magic link for passwordless login' })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Magic link sent successfully',
  // })
  // @HttpCode(HttpStatus.OK)
  // @Post('magic-link')
  // async sendMagicLink(@Body() magicLinkDto: MagicLinkDto) {
  //   await this.authService.sendMagicLink(magicLinkDto);
  //   return {
  //     success: true,
  //     message:
  //       'If your email is registered, you will receive a magic link shortly',
  //   };
  // }

  @ApiOperation({ summary: 'Get the current logged-in user' })
  @ApiResponse({
    status: 200,
    description: 'Returns the current user',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@GetUser() user: User) {
    return user;
  }

  @ApiOperation({ summary: 'Get active sessions for current user' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async getSessions(@GetUser() user: User) {
    return this.authService.getSessions(user.id);
  }

  @ApiOperation({ summary: 'Google OAuth login' })
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    // This route initiates the Google OAuth flow
  }

  @ApiOperation({ summary: 'Google OAuth callback' })
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleAuthCallback(@Req() req, @Res() res: Response) {
    // After successful Google authentication
    const token = req.user.accessToken;
    return res.redirect(
      `${this.configService.get('FRONTEND_URL')}/auth/callback?token=${token}`,
    );
  }

  @ApiOperation({ summary: 'Facebook OAuth login' })
  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  facebookAuth() {
    // This route initiates the Facebook OAuth flow
  }

  @ApiOperation({ summary: 'Facebook OAuth callback' })
  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  facebookAuthCallback(@Req() req, @Res() res: Response) {
    // After successful Facebook authentication
    const token = req.user.accessToken;
    return res.redirect(
      `${this.configService.get('FRONTEND_URL')}/auth/callback?token=${token}`,
    );
  }

  @ApiOperation({ summary: 'GitHub OAuth login' })
  @Get('github')
  @UseGuards(AuthGuard('github'))
  githubAuth() {
    // This route initiates the GitHub OAuth flow
  }

  @ApiOperation({ summary: 'GitHub OAuth callback' })
  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  githubAuthCallback(@Req() req, @Res() res: Response) {
    // After successful GitHub authentication
    const token = req.user.accessToken;
    return res.redirect(
      `${this.configService.get('FRONTEND_URL')}/auth/callback?token=${token}`,
    );
  }

  @ApiOperation({ summary: 'Log out the current user' })
  @ApiResponse({
    status: 200,
    description: 'User logged out successfully',
  })
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req, @Res({ passthrough: true }) res: Response) {
    // Invalidate the session
    const sessionId = req.user.sessionId;
    if (!sessionId) {
      throw new UnauthorizedException('Invalid session');
    }

    // Use the authService to invalidate the session
    await this.authService.invalidateSession(sessionId);

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken', { path: '/api/auth' });

    return { success: true, message: 'Logged out successfully' };
  }

  // @ApiOperation({ summary: 'Verify a magic link' })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Magic link verified successfully',
  // })
  // @Get('verify-magic-link/:token')
  // async verifyMagicLink(
  //   @Param('token') token: string,
  //   @Req() req,
  //   @Res() res: Response,
  // ) {
  //   try {
  //     const result = await this.authService.verifyMagicLink(token, req);
  //     // Redirect to frontend with token
  //     return res.redirect(
  //       `${this.configService.get('FRONTEND_URL')}/auth/callback?token=${result.accessToken}`,
  //     );
  //   } catch (error) {
  //     // Redirect to error page
  //     return res.redirect(
  //       `${this.configService.get('FRONTEND_URL')}/auth/error?message=${error.message}`,
  //     );
  //   }
  // }

  @ApiOperation({ summary: 'Verify email address' })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
  })
  @Get('verify-email/:token')
  async verifyEmail(@Param('token') token: string, @Res() res: Response) {
    try {
      await this.authService.verifyEmail(token);
      // Redirect to success page
      return res.redirect(
        `${this.configService.get('FRONTEND_URL')}/auth/email-verified`,
      );
    } catch (error) {
      // Redirect to error page
      return res.redirect(
        `${this.configService.get('FRONTEND_URL')}/auth/error?message=${error.message}`,
      );
    }
  }

  @ApiOperation({ summary: 'Request magic link for passwordless login' })
  @ApiResponse({
    status: 200,
    description: 'Magic link sent successfully',
  })
  @HttpCode(HttpStatus.OK)
  @Post('magic-link')
  async sendMagicLink(@Body() magicLinkDto: MagicLinkDto, @Req() req) {
    await this.magicLinkService.sendMagicLink(
      magicLinkDto.email,
      req.ip,
      req.headers['user-agent'],
    );
    return {
      success: true,
      message:
        'If your email is registered, you will receive a magic link shortly',
    };
  }

  // Update verifyMagicLink to use the MagicLinkService
  @ApiOperation({ summary: 'Verify a magic link' })
  @ApiResponse({
    status: 200,
    description: 'Magic link verified successfully',
  })
  @Get('verify-magic-link/:token')
  async verifyMagicLink(
    @Param('token') token: string,
    @Req() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.magicLinkService.verifyMagicLink(
        token,
        req.ip,
        req.headers['user-agent'],
      );

      const accessToken = result.accessToken;
      const refreshToken = result.refreshToken;

      // Set HTTP-only cookie with the access token
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: result.expiresAt * 1000,
        path: '/', // Set path to root
        domain: 'localhost', // Explicitly set domain (optional, might help)
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: result.refreshTokenExpiresAt * 1000,
        path: '/', // Set path to root instead of '/auth/refresh-token'
        domain: 'localhost', // Explicitly set domain (optional, might help)
      });

      // Trả về kết quả JSON thay vì redirect
      return {
        success: true,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt,
        user: result.user,
      };
    } catch (error) {
      // Trả về lỗi JSON thay vì redirect
      throw new UnauthorizedException(
        error.message || 'Invalid or expired magic link',
      );
    }
  }

  @ApiOperation({ summary: 'Revoke all sessions except current one' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('revoke-all-sessions')
  async revokeAllSessions(@Req() req, @GetUser() user: User) {
    return this.authService.revokeAllSessions(user.id, req.user.sessionId);
  }

  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  async revokeSession(@Param('id') id: string, @GetUser() user: User) {
    return this.authService.revokeSession(id, user.id);
  }

  @ApiOperation({ summary: 'Quên mật khẩu' })
  @ApiResponse({
    status: 200,
    description: 'Email đặt lại mật khẩu đã được gửi thành công',
  })
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  async forgotPassword(
    @Body() forgetPasswordDto: ForgetPasswordDto,
    @Req() req,
  ) {
    await this.authService.forgotPassword(forgetPasswordDto.email, req);
    return {
      success: true,
      message:
        'Nếu email của bạn đã đăng ký, bạn sẽ nhận được email đặt lại mật khẩu',
    };
  }

  // Thêm endpoint đặt lại mật khẩu
  @ApiOperation({ summary: 'Đặt lại mật khẩu' })
  @ApiResponse({
    status: 200,
    description: 'Mật khẩu đã được đặt lại thành công',
  })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto, @Req() req) {
    await this.authService.resetPassword(
      req,
      resetPasswordDto.token,
      resetPasswordDto.password,
      resetPasswordDto.securityInfo,
    );
    return {
      success: true,
      message: 'Mật khẩu đã được đặt lại thành công',
    };
  }

  // Thêm endpoint thay đổi mật khẩu cho người dùng đã đăng nhập
  @ApiOperation({ summary: 'Thay đổi mật khẩu (người dùng đã đăng nhập)' })
  @ApiResponse({
    status: 200,
    description: 'Mật khẩu đã được thay đổi thành công',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  async changePassword(
    @GetUser() user: User,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    await this.usersService.changePassword(
      user.id,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );
    return {
      success: true,
      message: 'Mật khẩu đã được thay đổi thành công',
    };
  }
}
