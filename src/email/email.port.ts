// src/email/email.port.ts
export interface IEmailService {
  sendVerificationEmail(
    to: string,
    name: string | null,
    token: string,
  ): Promise<string>;
  
  sendPasswordResetEmail(
    to: string,
    name: string | null,
    token: string,
  ): Promise<string>;
  
  sendWelcomeEmail(
    to: string, 
    name: string | null
  ): Promise<string>;
  
  sendTwoFactorBackupCodesEmail(
    to: string,
    name: string | null,
    codes: string[],
  ): Promise<string>;
  
  sendLoginNotificationEmail(
    to: string,
    name: string | null,
    device: string,
    location: string,
    time: Date,
  ): Promise<string>;
  
  sendLoginAttemptNotificationEmail(
    to: string,
    name: string | null,
    device: string,
    location: string,
    time: Date,
  ): Promise<string>;
  
  getEmailStatus(emailId: string): Promise<any>; 
  
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