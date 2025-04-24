// src/email/oauth2.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OAuthCredential } from './entities/oauth-credential.entity';

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
  scope?: string;
}

@Injectable()
export class OAuth2Service implements OnModuleInit {
  private readonly logger = new Logger(OAuth2Service.name);
  private cachedTokens: Map<string, { token: string; expiresAt: number }> = new Map();

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(OAuthCredential)
    private readonly oauthRepository: Repository<OAuthCredential>,
  ) {}

  async onModuleInit() {
    // Initialize by loading stored credentials if available
    try {
      const storedCredentials = await this.oauthRepository.findOne({ 
        where: { provider: 'gmail', isActive: true },
        order: { createdAt: 'DESC' } 
      });
      
      if (storedCredentials) {
        this.logger.log('Found stored OAuth credentials for Gmail');
        
        // Add to cache if not expired
        if (storedCredentials.expiresAt > new Date()) {
          this.cachedTokens.set('gmail-token', {
            token: storedCredentials.accessToken,
            expiresAt: storedCredentials.expiresAt.getTime(),
          });
        } else {
          // Refresh token if expired
          this.logger.log('Stored token is expired, refreshing...');
          await this.refreshGmailToken(storedCredentials.refreshToken);
        }
      }
    } catch (error) {
      this.logger.error(`Error initializing OAuth service: ${error.message}`);
    }
  }

  async getGmailAccessToken(): Promise<string> {
    const cacheKey = 'gmail-token';
    const cached = this.cachedTokens.get(cacheKey);

    // Return cached token if it's not expired
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    // Try to get the refresh token from the database
    const credentials = await this.oauthRepository.findOne({
      where: { provider: 'gmail', isActive: true },
      order: { createdAt: 'DESC' }
    });

    if (!credentials?.refreshToken) {
      throw new Error('No refresh token available for Gmail. Please authenticate first.');
    }

    // Refresh the token
    return this.refreshGmailToken(credentials.refreshToken);
  }

  private async refreshGmailToken(storedRefreshToken?: string): Promise<string> {
    const clientId = this.configService.get<string>('GMAIL_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GMAIL_CLIENT_SECRET');
    const refreshToken = storedRefreshToken || this.configService.get<string>('GMAIL_REFRESH_TOKEN');

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error(
        'Missing Gmail OAuth credentials. Please set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN or authenticate.',
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

      // Update stored credentials
      await this.updateStoredCredentials({
        accessToken: data.access_token, 
        refreshToken,
        expiresAt: new Date(expiresAt)
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
   * Generate XOAUTH2 token for SMTP authentication
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

      const data = await response.json() as TokenResponse;
      const expiresAt = new Date(Date.now() + data.expires_in * 1000);

      // Save tokens in database
      await this.saveOAuthTokens({
        accessToken: data.access_token,
        refreshToken: data.refresh_token || '',
        expiresAt,
      });

      // Update cache
      this.cachedTokens.set('gmail-token', {
        token: data.access_token,
        expiresAt: expiresAt.getTime(),
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
    expiresAt: Date;
  }): Promise<void> {
    try {
      // Deactivate previous tokens
      await this.oauthRepository.update(
        { provider: 'gmail', isActive: true },
        { isActive: false }
      );

      // Create new credentials
      const credential = this.oauthRepository.create({
        provider: 'gmail',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        isActive: true,
      });

      await this.oauthRepository.save(credential);
      this.logger.log('OAuth tokens saved successfully to database');
    } catch (error) {
      this.logger.error(`Error saving OAuth tokens: ${error.message}`);
      throw error;
    }
  }

  private async updateStoredCredentials(tokens: {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }): Promise<void> {
    try {
      const credential = await this.oauthRepository.findOne({
        where: { provider: 'gmail', isActive: true }
      });

      if (credential) {
        credential.accessToken = tokens.accessToken;
        credential.expiresAt = tokens.expiresAt;
        await this.oauthRepository.save(credential);
        this.logger.log('Updated stored OAuth credentials');
      } else {
        await this.saveOAuthTokens(tokens);
      }
    } catch (error) {
      this.logger.error(`Error updating OAuth credentials: ${error.message}`);
    }
  }

  async revokeToken(): Promise<boolean> {
    try {
      const credential = await this.oauthRepository.findOne({
        where: { provider: 'gmail', isActive: true }
      });

      if (!credential) {
        return false;
      }

      const clientId = this.configService.get<string>('GMAIL_CLIENT_ID');
      const token = credential.accessToken;

      const params = new URLSearchParams({
        token,
        client_id: clientId,
      });

      const response = await fetch(`https://oauth2.googleapis.com/revoke?${params.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        this.logger.error(`Failed to revoke token: ${errorData}`);
      }

      // Deactivate token in database regardless of revoke result
      credential.isActive = false;
      await this.oauthRepository.save(credential);
      
      // Remove from cache
      this.cachedTokens.delete('gmail-token');

      return true;
    } catch (error) {
      this.logger.error(`Error revoking token: ${error.message}`);
      return false;
    }
  }
}