// src/email/oauth2.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

@Injectable()
export class OAuth2Service {
  private readonly logger = new Logger(OAuth2Service.name);
  private cachedTokens: Map<string, { token: string; expiresAt: number }> =
    new Map();

  constructor(private readonly configService: ConfigService) {}

  async getGmailAccessToken(): Promise<string> {
    const cacheKey = 'gmail-token';
    const cached = this.cachedTokens.get(cacheKey);

    // Return cached token if it's not expired
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    // Otherwise refresh the token
    return this.refreshGmailToken();
  }

  private async refreshGmailToken(): Promise<string> {
    const clientId = this.configService.get<string>('GMAIL_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GMAIL_CLIENT_SECRET');
    const refreshToken = this.configService.get<string>('GMAIL_REFRESH_TOKEN');

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error(
        'Missing Gmail OAuth credentials. Please set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN.',
      );
    }

    try {
      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `Failed to refresh token: ${response.status} ${errorData}`,
        );
      }

      const data = (await response.json()) as TokenResponse;

      // Cache the token with expiry
      const expiresAt = Date.now() + data.expires_in * 1000 - 60000; // Subtract 1 minute for safety
      this.cachedTokens.set('gmail-token', {
        token: data.access_token,
        expiresAt,
      });

      this.logger.log('Successfully refreshed Gmail access token');

      return data.access_token;
    } catch (error) {
      this.logger.error(
        `Error refreshing Gmail token: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Tạo XOAUTH2 token cho SMTP authentication
   * Format: base64("user=" + userId + "^Aauth=Bearer " + accessToken + "^A^A")
   */
  async generateXOAuth2Token(email: string): Promise<string> {
    const accessToken = await this.getGmailAccessToken();
    const authString = `user=${email}\x01auth=Bearer ${accessToken}\x01\x01`;
    return Buffer.from(authString).toString('base64');
  }

  async exchangeCodeForTokens(code: string): Promise<void> {
    const clientId = this.configService.get<string>('GMAIL_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GMAIL_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('GMAIL_REDIRECT_URI');

    try {
      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      });

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `Failed to exchange code for tokens: ${response.status} ${errorData}`,
        );
      }

      const data = await response.json();

      // Save tokens in a secure way
      // In a real application, encrypt these tokens before storing
      await this.saveOAuthTokens({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      });

      this.logger.log('Successfully obtained OAuth tokens');
    } catch (error) {
      this.logger.error(
        `Error exchanging code for tokens: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async saveOAuthTokens(tokens: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  }): Promise<void> {
    // In a real application, you would save these tokens to a secure database
    // Consider encrypting sensitive data before storing

    // For demonstration, we're using environment variables via ConfigService
    // This would require a way to update environment variables at runtime
    // or preferably a secure database or secret manager

    // This is a simplified implementation
    this.cachedTokens.set('gmail-token', {
      token: tokens.accessToken,
      expiresAt: tokens.expiresAt,
    });

    // In a real application, you would securely save the refresh token
    this.logger.log('OAuth tokens saved successfully');
  }
}
