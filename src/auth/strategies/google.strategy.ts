// src/auth/strategies/google.strategy.ts
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);
  private isEnabled = false;

  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL');

    // Always call super() first with some configuration
    super({
      clientID: clientID || 'dummy-id',
      clientSecret: clientSecret || 'dummy-secret',
      callbackURL: callbackURL || 'http://localhost:3000/auth/google/callback',
      scope: ['email', 'profile'],
    });

    // Then check if strategy is properly configured
    this.isEnabled = !!(clientID && clientSecret && callbackURL);

    if (!this.isEnabled) {
      this.logger.warn(
        'Google OAuth strategy is disabled due to missing configuration',
      );
    } else {
      this.logger.log('Google OAuth strategy initialized');
    }
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    // If strategy is not enabled, return error
    if (!this.isEnabled) {
      return done(new Error('Google OAuth is not configured'), null);
    }

    try {
      const { id, emails, name, photos } = profile;
      const user = await this.authService.findOrCreateOAuthUser({
        provider: 'google',
        providerId: id,
        email: emails?.[0]?.value || `${id}@google.com`,
        fullName: name
          ? `${name.givenName || ''} ${name.familyName || ''}`.trim()
          : '',
        avatarUrl: photos?.[0]?.value || null,
        accessToken,
        refreshToken,
        profile,
      });
      done(null, user);
    } catch (error) {
      this.logger.error(
        `Error in Google strategy validation: ${error.message}`,
      );
      done(error, null);
    }
  }
}
