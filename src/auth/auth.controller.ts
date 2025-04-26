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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { GetUser } from './decorators/get-user.decorator';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { MagicLinkDto } from './dto/magic-link.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
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

  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiResponse({
    status: 200,
    description: 'User logged in successfully',
  })
  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Body() loginDto: LoginDto, @Req() req) {
    return this.authService.login(loginDto, req);
  }

  @ApiOperation({ summary: 'Send a magic link for passwordless login' })
  @ApiResponse({
    status: 200,
    description: 'Magic link sent successfully',
  })
  @HttpCode(HttpStatus.OK)
  @Post('magic-link')
  async sendMagicLink(@Body() magicLinkDto: MagicLinkDto) {
    await this.authService.sendMagicLink(magicLinkDto);
    return {
      success: true,
      message:
        'If your email is registered, you will receive a magic link shortly',
    };
  }

  @ApiOperation({ summary: 'Verify a magic link' })
  @ApiResponse({
    status: 200,
    description: 'Magic link verified successfully',
  })
  @Get('verify-magic-link/:token')
  async verifyMagicLink(
    @Param('token') token: string,
    @Req() req,
    @Res() res: Response,
  ) {
    try {
      const result = await this.authService.verifyMagicLink(token, req);
      // Redirect to frontend with token
      return res.redirect(
        `${this.configService.get('FRONTEND_URL')}/auth/callback?token=${result.accessToken}`,
      );
    } catch (error) {
      // Redirect to error page
      return res.redirect(
        `${this.configService.get('FRONTEND_URL')}/auth/error?message=${error.message}`,
      );
    }
  }

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

  @ApiOperation({ summary: 'Get the current logged-in user' })
  @ApiResponse({
    status: 200,
    description: 'Returns the current user',
  })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@GetUser() user: User) {
    return user;
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
  async logout(@Req() req) {
    // Invalidate the session
    const sessionId = req.user.sessionId;
    if (!sessionId) {
      throw new UnauthorizedException('Invalid session');
    }

    // Update session in database
    // This would typically be handled by your session service
    return { success: true, message: 'Logged out successfully' };
  }
}
