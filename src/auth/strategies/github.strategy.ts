// src/auth/strategies/github.strategy.ts
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID'),
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET'),
      callbackURL: configService.get<string>('GITHUB_CALLBACK_URL'),
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: any,
  ): Promise<any> {
    const { id, emails, displayName, photos } = profile;

    let email = '';
    // GitHub may return multiple emails, use the primary or first one
    if (emails && emails.length > 0) {
      const primaryEmail = emails.find((e) => e.primary);
      email = primaryEmail ? primaryEmail.value : emails[0].value;
    }

    const user = await this.authService.findOrCreateOAuthUser({
      provider: 'github',
      providerId: id,
      email: email || `${id}@github.com`,
      fullName: displayName || '',
      avatarUrl: photos && photos.length > 0 ? photos[0].value : null,
      accessToken,
      refreshToken,
      profile,
    });

    done(null, user);
  }
}
