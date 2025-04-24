// src/email/oauth2.controller.ts
import { Controller, Get, Res, Query, Req, UseGuards } from '@nestjs/common';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { OAuth2Service } from './oauth2.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('oauth')
@Controller('api/admin/oauth')
export class OAuth2Controller {
  constructor(
    private readonly oauth2Service: OAuth2Service,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({ summary: 'Get Google OAuth URL for authorization' })
  @UseGuards(AdminGuard)
  @Get('google/auth-url')
  getGoogleAuthUrl() {
    const clientId = this.configService.get('GMAIL_CLIENT_ID');
    const redirectUri = this.configService.get('GMAIL_REDIRECT_URI');

    const scopes = [
      'https://mail.google.com/',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email',
    ];

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.append('client_id', clientId);
    url.searchParams.append('redirect_uri', redirectUri);
    url.searchParams.append('response_type', 'code');
    url.searchParams.append('access_type', 'offline');
    url.searchParams.append('prompt', 'consent');
    url.searchParams.append('scope', scopes.join(' '));

    return { url: url.toString() };
  }

  @ApiOperation({
    summary: 'Handle OAuth callback and exchange code for tokens',
  })
  @Get('google/callback')
  async handleGoogleCallback(
    @Query('code') code: string,
    @Res() res: Response,
  ) {
    try {
      await this.oauth2Service.exchangeCodeForTokens(code);
      return res.redirect('/settings?oauth=success');
    } catch (error) {
      return res.redirect('/settings?oauth=error');
    }
  }

  @ApiOperation({ summary: 'Test OAuth connection' })
  @UseGuards(AdminGuard)
  @Get('google/test')
  async testGoogleConnection() {
    try {
      const token = await this.oauth2Service.getGmailAccessToken();
      return { success: true, tokenPresent: !!token };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
