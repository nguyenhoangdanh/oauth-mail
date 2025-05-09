// src/email/email.port.ts
/**
 * Email service interface defining required methods for any email provider implementation
 */
export interface IEmailService {
  /**
   * Sends an email using a template with context variables
   * @param to Recipient email or array of emails
   * @param subject Email subject
   * @param template Template name to use
   * @param context Object containing variables to inject into the template
   * @param options Additional options for the email
   */
  queueEmail(
    to: string | string[],
    subject: string,
    template: string,
    context: Record<string, any>,
    options?: EmailOptions,
  ): Promise<string>;

  /**
   * Sends a verification email to a new user
   * @param email User's email address
   * @param name User's name
   * @param token Verification token
   */
  sendVerificationEmail(
    email: string,
    name: string,
    token: string,
  ): Promise<string>;

  sendVerificationCode(
    email: string,
    name: string | null,
    code: string,
  ): Promise<string>;

  /**
   * Sends a password reset email
   * @param email User's email address
   * @param name User's name
   * @param token Reset token
   */
  sendPasswordResetEmail(
    email: string,
    name: string,
    token: string,
  ): Promise<string>;

  /**
   * Sends a welcome email after registration
   * @param email User's email address
   * @param name User's name
   */
  sendWelcomeEmail(email: string, name: string): Promise<string>;

  /**
   * Sends a notification about new login
   * @param email User's email address
   * @param name User's name
   * @param loginInfo Information about the login (device, location, etc.)
   */
  // sendLoginNotification(
  //   email: string,
  //   name: string,
  //   loginInfo: LoginInfo,
  // ): Promise<void>;

  /**
   * Send 2FA backup codes email
   * @param email User's email address
   * @param name User's name
   * @param backupCodes Array of backup codes
   */
  sendTwoFactorBackupCodesEmail(
    email: string,
    name: string,
    backupCodes: string[],
  ): Promise<string>;

  /**
   * Send magic link email
   * @param email User's email address
   * @param name User's name
   * @param token Magic link token
   */
  sendMagicLinkEmail(email: string, name: string, token: string): Promise<void>;

  sendPasswordResetEmail(
    email: string,
    name: string,
    token: string,
  ): Promise<string>;
}

/**
 * Additional options for sending an email
 */
export interface EmailOptions {
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: EmailAttachment[];
  tags?: string[];
  campaignId?: string;
  batchId?: string;
  trackOpens?: boolean;
  trackClicks?: boolean;
  ipAddress?: string;
  deliveryTime?: Date;
  userId?: string;
  isTest?: boolean;
  replyTo?: string;
  customHeaders?: Record<string, string>;
  priority?: 'high' | 'normal' | 'low';
}

/**
 * Email attachment
 */
export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
  cid?: string; // Content ID for inline images
}

/**
 * Login information for notifications
 */
export interface LoginInfo {
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  location?: string;
  time?: Date;
  isNewDevice?: boolean;
}
