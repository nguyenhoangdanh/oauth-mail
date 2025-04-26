// // src/email/direct-email.service.ts
// import { Injectable, Logger } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import * as nodemailer from 'nodemailer';
// import { OAuth2Service } from './oauth2.service';

// @Injectable()
// export class DirectEmailService {
//   private readonly logger = new Logger(DirectEmailService.name);
//   private readonly appName: string;
//   private readonly emailFrom: string;

//   constructor(
//     private readonly configService: ConfigService,
//     private readonly oauth2Service: OAuth2Service,
//   ) {
//     this.appName = this.configService.get<string>('APP_NAME', 'SecureMail');
//     this.emailFrom = this.configService.get<string>('EMAIL_FROM');
//   }

//   async sendTestEmail(to: string, subject: string, text: string): Promise<any> {
//     try {
//       // Check if OAuth is enabled
//       const useOAuth =
//         this.configService.get<string>('EMAIL_USE_OAUTH') === 'true';

//       if (!useOAuth) {
//         return {
//           success: false,
//           message:
//             'OAuth is not enabled. Set EMAIL_USE_OAUTH=true in your .env file.',
//         };
//       }

//       // Get access token from OAuth service
//       const accessToken = await this.oauth2Service.getGmailAccessToken();
//       this.logger.log('Successfully obtained Gmail access token');

//       // Create transporter with OAuth
//       const transporter = nodemailer.createTransport({
//         service: 'gmail',
//         auth: {
//           type: 'OAuth2',
//           user: this.emailFrom,
//           clientId: this.configService.get<string>('GMAIL_CLIENT_ID'),
//           clientSecret: this.configService.get<string>('GMAIL_CLIENT_SECRET'),
//           refreshToken: this.configService.get<string>('GMAIL_REFRESH_TOKEN'),
//           accessToken,
//         },
//         debug: true, // Enable debug logging
//       });

//       // Verify connection
//       await transporter.verify();
//       this.logger.log('SMTP connection verified successfully');

//       // Send mail
//       const info = await transporter.sendMail({
//         from: `"${this.appName}" <${this.emailFrom}>`,
//         to,
//         subject,
//         text,
//         html: `
//           <h2>${subject}</h2>
//           <p>${text}</p>
//           <p>This is a direct test email sent at: ${new Date().toISOString()}</p>
//           <p>If you're seeing this, your email configuration is working properly!</p>
//         `,
//       });

//       this.logger.log(
//         `Email sent successfully to ${to}, message ID: ${info.messageId}`,
//       );

//       return {
//         success: true,
//         messageId: info.messageId,
//         info,
//       };
//     } catch (error) {
//       this.logger.error(
//         `Failed to send direct email: ${error.message}`,
//         error.stack,
//       );
//       return {
//         success: false,
//         error: error.message,
//         stack: error.stack,
//       };
//     }
//   }
// }
