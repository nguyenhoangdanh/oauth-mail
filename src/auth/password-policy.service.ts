import { Injectable } from '@nestjs/common';

// auth/password-policy.service.ts
@Injectable()
export class PasswordPolicyService {
  validatePassword(password: string): { valid: boolean; reason?: string } {
    // Minimum length
    if (password.length < 8) {
      return {
        valid: false,
        reason: 'Password must be at least 8 characters long',
      };
    }

    // Must contain lowercase letter
    if (!/[a-z]/.test(password)) {
      return {
        valid: false,
        reason: 'Password must contain at least one lowercase letter',
      };
    }

    // Must contain uppercase letter
    if (!/[A-Z]/.test(password)) {
      return {
        valid: false,
        reason: 'Password must contain at least one uppercase letter',
      };
    }

    // Must contain number
    if (!/\d/.test(password)) {
      return {
        valid: false,
        reason: 'Password must contain at least one number',
      };
    }

    // Must contain special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return {
        valid: false,
        reason: 'Password must contain at least one special character',
      };
    }

    // Check for common passwords (simplified example)
    const commonPasswords = ['Password123!', 'Admin123!', 'Welcome1!'];
    if (commonPasswords.includes(password)) {
      return { valid: false, reason: 'Password is too common' };
    }

    return { valid: true };
  }
}
