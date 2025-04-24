export interface IEmailService {
  sendVerificationEmail(
    to: string,
    name: string | null,
    token: string,
  ): Promise<void>;
  sendPasswordResetEmail(
    to: string,
    name: string | null,
    token: string,
  ): Promise<void>;
  sendWelcomeEmail(to: string, name: string | null): Promise<void>;
  sendTwoFactorBackupCodesEmail(
    to: string,
    name: string | null,
    codes: string[],
  ): Promise<void>;
  sendLoginNotificationEmail(
    to: string,
    name: string | null,
    device: string,
    location: string,
    time: Date,
  ): Promise<void>;
  sendLoginAttemptNotificationEmail(
    to: string,
    name: string | null,
    device: string,
    location: string,
    time: Date,
  ): Promise<void>;
}
