// src/auth/strategies/local.strategy.ts
import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
    });
  }

  async validate(email: string, password: string): Promise<any> {
    console.log('LocalStrategy.validate called with email:', email);

    try {
      const user = await this.authService.validateUser(email, password);
      if (!user) {
        console.log('User validation failed for email:', email);
        throw new UnauthorizedException('Invalid credentials');
      }
      console.log('User validated successfully:', user.id);
      return user;
    } catch (error) {
      console.error('Error in LocalStrategy.validate:', error.message);
      throw error;
    }
  }
}
