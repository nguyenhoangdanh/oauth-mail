// src/auth/strategies/facebook.strategy.ts
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('FACEBOOK_APP_ID'),
      clientSecret: configService.get<string>('FACEBOOK_APP_SECRET'),
      callbackURL: configService.get<string>('FACEBOOK_CALLBACK_URL'),
      profileFields: ['id', 'emails', 'name', 'picture.type(large)'],
      scope: ['email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: any,
    req?: any,
  ): Promise<any> {
    const { id, name, emails, photos } = profile;

    const user = await this.authService.findOrCreateOAuthUser(
      {
        provider: 'facebook',
        providerId: id,
        email: emails && emails[0] ? emails[0].value : `${id}@facebook.com`,
        fullName: name
          ? `${name.givenName || ''} ${name.familyName || ''}`.trim()
          : '',
        avatarUrl: photos && photos[0] ? photos[0].value : null,
        accessToken,
        refreshToken,
        profile,
      },
      req || ({} as Request), // Pass request object to the service
    );

    done(null, user);
  }
}
