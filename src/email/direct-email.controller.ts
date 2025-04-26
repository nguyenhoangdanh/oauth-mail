// // src/email/direct-email.controller.ts
// import { Controller, Post, Body, Logger } from '@nestjs/common';
// import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
// import { DirectEmailService } from './direct-email.service';

// @ApiTags('direct-email')
// @Controller('direct-email')
// export class DirectEmailController {
//   private readonly logger = new Logger(DirectEmailController.name);

//   constructor(private readonly directEmailService: DirectEmailService) {}

//   @ApiOperation({ summary: 'Send a test email directly (bypassing queue)' })
//   @ApiResponse({
//     status: 200,
//     description: 'Direct email sending result',
//   })
//   @Post('test')
//   async sendTestEmail(
//     @Body() data: { to: string; subject?: string; text?: string },
//   ) {
//     const {
//       to,
//       subject = 'Direct Test Email',
//       text = 'This is a test email sent directly via nodemailer',
//     } = data;

//     this.logger.log(`Attempting to send direct test email to ${to}`);

//     const result = await this.directEmailService.sendTestEmail(
//       to,
//       subject,
//       text,
//     );

//     if (result.success) {
//       this.logger.log('Direct email test completed successfully');
//     } else {
//       this.logger.error(`Direct email test failed: ${result.error}`);
//     }

//     return result;
//   }
// }
