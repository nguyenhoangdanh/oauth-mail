// src/email/email.port.ts
export interface IEmailService {
  /**
   * Send a verification email
   * @param to Recipient email address
   * @param name Optional recipient name
   * @param token Verification token
   * @returns Promise with email ID
   */
  sendVerificationEmail(
    to: string,
    name: string | null,
    token: string,
  ): Promise<string>;
  
  /**
   * Send a password reset email
   * @param to Recipient email address
   * @param name Optional recipient name
   * @param token Reset token
   * @returns Promise with email ID
   */
  sendPasswordResetEmail(
    to: string,
    name: string | null,
    token: string,
  ): Promise<string>;
  
  /**
   * Send a welcome email
   * @param to Recipient email address
   * @param name Optional recipient name
   * @returns Promise with email ID
   */
  sendWelcomeEmail(
    to: string, 
    name: string | null
  ): Promise<string>;
  
  /**
   * Send 2FA backup codes email
   * @param to Recipient email address
   * @param name Optional recipient name
   * @param codes Array of backup codes
   * @returns Promise with email ID
   */
  sendTwoFactorBackupCodesEmail(
    to: string,
    name: string | null,
    codes: string[],
  ): Promise<string>;
  
  /**
   * Send login notification email
   * @param to Recipient email address
   * @param name Optional recipient name
   * @param device Device information
   * @param location Location information
   * @param time Time of login
   * @returns Promise with email ID
   */
  sendLoginNotificationEmail(
    to: string,
    name: string | null,
    device: string,
    location: string,
    time: Date,
  ): Promise<string>;
  
  /**
   * Send login attempt notification email for suspicious activities
   * @param to Recipient email address
   * @param name Optional recipient name
   * @param device Device information
   * @param location Location information
   * @param time Time of login attempt
   * @returns Promise with email ID
   */
  sendLoginAttemptNotificationEmail(
    to: string,
    name: string | null,
    device: string,
    location: string,
    time: Date,
  ): Promise<string>;
  
  /**
   * Queue an email to be sent
   * @param to Recipient email address
   * @param subject Email subject
   * @param template Template name
   * @param context Template context data
   * @param options Additional options
   * @returns Promise with email ID
   */
  queueEmail(
    to: string,
    subject: string,
    template: string,
    context?: Record<string, any>,
    options?: any
  ): Promise<string>;
  
  /**
   * Send emails in bulk
   * @param recipients Array of recipients
   * @param subject Email subject
   * @param template Template name
   * @param context Template context data
   * @param options Additional options
   * @returns Promise with batch information
   */
  sendBulkEmails(
    recipients: Array<{ email: string; name?: string; context?: Record<string, any> }>,
    subject: string,
    template: string,
    context?: Record<string, any>,
    options?: any
  ): Promise<{ batchId: string; queued: number }>;
  
  /**
   * Get email status by email ID
   * @param emailId Email ID
   * @returns Promise with email log or null
   */
  getEmailStatus(emailId: string): Promise<any>;
  
  /**
   * Resend a failed email
   * @param emailId Email ID to resend
   * @returns Promise with new email ID
   */
  resendEmail(emailId: string): Promise<string | null>;
}