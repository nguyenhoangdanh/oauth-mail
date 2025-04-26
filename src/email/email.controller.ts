// src/email/email.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  Inject,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { EmailLog, EmailStatus } from './entities/email-log.entity';
import { EmailEvent, EmailEventType } from './entities/email-event.entity';
import { EMAIL_SERVICE } from './email.di-token';
import { IEmailService } from './email.port';
import { SendEmailDto } from './dto/send-email.dto';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('email')
@Controller('email')
export class EmailController {
  constructor(
    @Inject(EMAIL_SERVICE)
    private emailService: IEmailService,
    @InjectRepository(EmailLog)
    private emailLogRepository: Repository<EmailLog>,
    @InjectRepository(EmailEvent)
    private emailEventRepository: Repository<EmailEvent>,
  ) {}

  @ApiOperation({ summary: 'Send a test email' })
  @ApiResponse({
    status: 200,
    description: 'Email queued successfully',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('send-test')
  async sendTestEmail(
    @Body() sendEmailDto: SendEmailDto,
    @GetUser() user: User,
  ) {
    try {
      // Set test flag
      const options = {
        ...sendEmailDto.options,
        isTest: true,
        userId: user.id,
      };

      // Queue email
      await this.emailService.queueEmail(
        sendEmailDto.to || user.email,
        sendEmailDto.subject,
        sendEmailDto.template,
        sendEmailDto.context || {},
        options,
      );

      return {
        success: true,
        message: 'Test email queued successfully',
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to send test email: ${error.message}`,
      );
    }
  }

  @ApiOperation({ summary: 'Track email open event' })
  @ApiResponse({
    status: 200,
    description: 'Tracking pixel returned',
  })
  @Get('track/:emailId/open')
  async trackOpen(
    @Param('emailId') emailId: string,
    @Query('r') recipientId: string,
    @Res() res: Response,
  ) {
    try {
      // Find email
      const emailLog = await this.emailLogRepository.findOne({
        where: { emailId },
      });

      if (emailLog) {
        // Update open count
        await this.emailLogRepository.update(
          { emailId },
          {
            openCount: () => '"openCount" + 1',
            status: EmailStatus.OPENED,
            openedAt: new Date(),
            lastStatusAt: new Date(),
          },
        );

        // Create event record
        await this.emailEventRepository.save({
          emailId,
          event: EmailEventType.OPENED,
          recipient: emailLog.to,
          timestamp: new Date(),
          metadata: {
            userAgent: res.req.headers['user-agent'],
            ipAddress: res.req.ip,
          },
        });
      }

      // Return 1x1 transparent pixel
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.end(
        Buffer.from(
          'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
          'base64',
        ),
      );
    } catch (error) {
      console.log('error', error);
      // Still return pixel even if tracking fails
      res.setHeader('Content-Type', 'image/gif');
      res.end(
        Buffer.from(
          'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
          'base64',
        ),
      );
    }
  }

  @ApiOperation({ summary: 'Track email link click' })
  @ApiResponse({
    status: 302,
    description: 'Redirect to the original URL',
  })
  @Get('track/:emailId/click')
  async trackClick(
    @Param('emailId') emailId: string,
    @Query('url') url: string,
    @Query('r') recipientId: string,
    @Res() res: Response,
  ) {
    try {
      if (!url) {
        throw new BadRequestException('URL parameter is required');
      }

      // Find email
      const emailLog = await this.emailLogRepository.findOne({
        where: { emailId },
      });

      if (emailLog) {
        // Update click count
        await this.emailLogRepository.update(
          { emailId },
          {
            clickCount: () => '"clickCount" + 1',
            clickedAt: new Date(),
            clickUrl: url,
            lastStatusAt: new Date(),
          },
        );

        // Create event record
        await this.emailEventRepository.save({
          emailId,
          event: EmailEventType.CLICKED,
          recipient: emailLog.to,
          timestamp: new Date(),
          metadata: {
            url,
            userAgent: res.req.headers['user-agent'],
            ipAddress: res.req.ip,
          },
        });
      }

      // Redirect to the original URL
      return res.redirect(url);
    } catch (error) {
      // If anything fails, still redirect to the original URL if possible
      if (url) {
        return res.redirect(url);
      }
      console.log('error', error);
      throw new BadRequestException('Invalid tracking link');
    }
  }

  @ApiOperation({ summary: 'Get email stats' })
  @ApiResponse({
    status: 200,
    description: 'Email statistics returned',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('stats')
  async getEmailStats() {
    try {
      const stats = await this.emailLogRepository
        .createQueryBuilder('email_logs')
        .select([
          "COUNT(DISTINCT CASE WHEN status = 'sent' THEN email_id END) as sent",
          "COUNT(DISTINCT CASE WHEN status = 'delivered' THEN email_id END) as delivered",
          "COUNT(DISTINCT CASE WHEN status = 'opened' THEN email_id END) as opened",
          'COUNT(DISTINCT CASE WHEN openCount > 0 THEN email_id END) as uniqueOpens',
          'SUM(openCount) as totalOpens',
          'COUNT(DISTINCT CASE WHEN clickCount > 0 THEN email_id END) as uniqueClicks',
          'SUM(clickCount) as totalClicks',
          "COUNT(DISTINCT CASE WHEN status = 'bounced' THEN email_id END) as bounced",
          "COUNT(DISTINCT CASE WHEN status = 'failed' THEN email_id END) as failed",
        ])
        .where('created_at >= :since', {
          since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        })
        .getRawOne();

      return {
        success: true,
        stats,
        period: '30 days',
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to retrieve email stats: ${error.message}`,
      );
    }
  }

  @ApiOperation({ summary: 'Get email history' })
  @ApiResponse({
    status: 200,
    description: 'Email history returned',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('history')
  async getEmailHistory(@GetUser() user: User) {
    try {
      // Get last 50 emails for this user
      const emails = await this.emailLogRepository.find({
        where: { userId: user.id },
        order: { createdAt: 'DESC' },
        take: 50,
      });

      return {
        success: true,
        emails: emails.map((email) => ({
          id: email.emailId,
          subject: email.subject,
          template: email.template,
          status: email.status,
          sentAt: email.sentAt,
          openedAt: email.openedAt,
          openCount: email.openCount,
          clickCount: email.clickCount,
        })),
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to retrieve email history: ${error.message}`,
      );
    }
  }

  @ApiOperation({ summary: 'Get email details' })
  @ApiResponse({
    status: 200,
    description: 'Email details returned',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':emailId')
  async getEmailDetails(
    @Param('emailId') emailId: string,
    @GetUser() user: User,
  ) {
    try {
      // Find email with proper permissions check
      const email = await this.emailLogRepository.findOne({
        where: { emailId },
      });

      if (!email) {
        throw new NotFoundException('Email not found');
      }

      // For security, check if user is admin or the email belongs to them
      if (email.userId !== user.id && !user.roles.includes('admin')) {
        throw new NotFoundException('Email not found');
      }

      // Get events
      const events = await this.emailEventRepository.find({
        where: { emailId },
        order: { timestamp: 'ASC' },
      });

      return {
        success: true,
        email: {
          id: email.emailId,
          to: email.to,
          subject: email.subject,
          template: email.template,
          status: email.status,
          sentAt: email.sentAt,
          messageId: email.messageId,
          openCount: email.openCount,
          clickCount: email.clickCount,
          openedAt: email.openedAt,
          clickedAt: email.clickedAt,
          campaignId: email.campaignId,
          batchId: email.batchId,
          tags: email.tags,
        },
        events: events.map((event) => ({
          event: event.event,
          timestamp: event.timestamp,
          metadata: event.metadata,
        })),
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to retrieve email details: ${error.message}`,
      );
    }
  }
}

// // src/email/email.controller.ts
// import {
//   Controller,
//   Post,
//   Body,
//   UseGuards,
//   Get,
//   Param,
//   Query,
//   Req,
//   Res,
//   HttpStatus,
//   HttpCode,
//   BadRequestException,
//   NotFoundException,
// } from '@nestjs/common';
// import {
//   ApiTags,
//   ApiOperation,
//   ApiBearerAuth,
//   ApiResponse,
//   ApiParam,
//   ApiQuery,
//   ApiBody,
// } from '@nestjs/swagger';
// import { Response, Request } from 'express';
// import { Inject } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { EMAIL_SERVICE } from './email.di-token';
// import { EmailService } from './email.service';
// import { EmailTrackingHelper } from './email.tracking.helper';
// import {
//   SendEmailDto,
//   VerificationEmailDto,
//   PasswordResetEmailDto,
//   BulkEmailDto,
//   WelcomeEmailDto,
// } from './dto/send-email.dto';
// import { AdminGuard } from '../auth/guards/admin.guard';

// @ApiTags('email')
// @Controller('email')
// export class EmailController {
//   constructor(
//     @Inject(EMAIL_SERVICE)
//     private readonly emailService: EmailService,
//     private readonly emailTrackingHelper: EmailTrackingHelper,
//     private readonly configService: ConfigService,
//   ) {}

//   /**
//    * Send verification email
//    */
//   @ApiOperation({ summary: 'Send a verification email' })
//   @ApiResponse({ status: 201, description: 'Email sent successfully' })
//   @ApiBearerAuth()
//   @UseGuards(AdminGuard)
//   @Post('send-verification')
//   @HttpCode(HttpStatus.CREATED)
//   async sendVerificationEmail(@Body() emailDto: VerificationEmailDto) {
//     const emailId = await this.emailService.sendVerificationEmail(
//       emailDto.to,
//       emailDto.name,
//       emailDto.token,
//     );

//     return {
//       success: true,
//       message: 'Verification email sent',
//       emailId,
//     };
//   }

//   /**
//    * Send password reset email
//    */
//   @ApiOperation({ summary: 'Send a password reset email' })
//   @ApiResponse({ status: 201, description: 'Email sent successfully' })
//   @ApiBearerAuth()
//   @UseGuards(AdminGuard)
//   @Post('send-password-reset')
//   @HttpCode(HttpStatus.CREATED)
//   async sendPasswordResetEmail(@Body() emailDto: PasswordResetEmailDto) {
//     const emailId = await this.emailService.sendPasswordResetEmail(
//       emailDto.to,
//       emailDto.name,
//       emailDto.token,
//     );

//     return {
//       success: true,
//       message: 'Password reset email sent',
//       emailId,
//     };
//   }

//   /**
//    * Send welcome email
//    */
//   @ApiOperation({ summary: 'Send a welcome email' })
//   @ApiResponse({ status: 201, description: 'Email sent successfully' })
//   @ApiBody({ type: WelcomeEmailDto })
//   @ApiBearerAuth()
//   // @UseGuards(AdminGuard)
//   @Post('send-welcome')
//   @HttpCode(HttpStatus.CREATED)
//   async sendWelcomeEmail(@Body() emailDto: { to: string; name?: string }) {
//     const emailId = await this.emailService.sendWelcomeEmail(
//       emailDto.to,
//       emailDto.name,
//     );

//     return {
//       success: true,
//       message: 'Welcome email sent',
//       emailId,
//     };
//   }

//   /**
//    * Send custom email using any template
//    */
//   @ApiOperation({ summary: 'Send a custom email using any template' })
//   @ApiResponse({ status: 201, description: 'Email sent successfully' })
//   @ApiBearerAuth()
//   @UseGuards(AdminGuard)
//   @Post('send')
//   @HttpCode(HttpStatus.CREATED)
//   async sendCustomEmail(@Body() emailDto: SendEmailDto) {
//     const emailId = await this.emailService.queueEmail(
//       emailDto.to,
//       emailDto.subject,
//       emailDto.template,
//       emailDto.context,
//       {
//         priority: emailDto.priority,
//         delay: emailDto.delay,
//       },
//     );

//     return {
//       success: true,
//       message: 'Email queued successfully',
//       emailId,
//     };
//   }

//   /**
//    * Send bulk emails
//    */
//   @ApiOperation({ summary: 'Send bulk emails' })
//   @ApiResponse({ status: 201, description: 'Bulk emails queued successfully' })
//   @ApiBearerAuth()
//   @UseGuards(AdminGuard)
//   @Post('send-bulk')
//   @HttpCode(HttpStatus.CREATED)
//   async sendBulkEmails(@Body() bulkEmailDto: BulkEmailDto) {
//     if (!bulkEmailDto.recipients || bulkEmailDto.recipients.length === 0) {
//       throw new BadRequestException(
//         'Recipients list is required and cannot be empty',
//       );
//     }

//     const result = await this.emailService.sendBulkEmails(
//       bulkEmailDto.recipients,
//       bulkEmailDto.subject,
//       bulkEmailDto.template,
//       bulkEmailDto.context,
//       {
//         campaignId: bulkEmailDto.campaignId,
//         batchSize: bulkEmailDto.batchSize,
//       },
//     );

//     return {
//       success: true,
//       message: `Bulk emails queued successfully (${result.queued} recipients)`,
//       batchId: result.batchId,
//       queued: result.queued,
//     };
//   }

//   /**
//    * Track email opens
//    */
//   @ApiOperation({ summary: 'Track email opens' })
//   @ApiParam({ name: 'id', description: 'Email ID to track' })
//   @Get('tracker/:id/open')
//   async trackOpen(
//     @Param('id') emailId: string,
//     @Req() request: Request,
//     @Res() res: Response,
//   ) {
//     // Get IP and user agent info
//     const userAgent = request.headers['user-agent'] || '';
//     const ipAddress =
//       request.ip ||
//       request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
//       '';

//     // Track email open
//     await this.emailTrackingHelper.trackOpen(emailId, {
//       userAgent,
//       ipAddress,
//       device: this.emailTrackingHelper.extractDeviceInfo(userAgent),
//     });

//     // Return a 1x1 transparent pixel
//     const pixel = Buffer.from(
//       'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
//       'base64',
//     );

//     res.setHeader('Content-Type', 'image/gif');
//     res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
//     res.setHeader('Pragma', 'no-cache');
//     res.setHeader('Expires', '0');
//     return res.send(pixel);
//   }

//   /**
//    * Track email clicks
//    */
//   @ApiOperation({ summary: 'Track email link clicks and redirect' })
//   @ApiParam({ name: 'id', description: 'Email ID to track' })
//   @ApiQuery({ name: 'url', description: 'URL to redirect to after tracking' })
//   @Get('tracker/:id/click')
//   async trackClick(
//     @Param('id') emailId: string,
//     @Query('url') url: string,
//     @Req() request: Request,
//     @Res() res: Response,
//   ) {
//     if (!url) {
//       return res.status(400).send('Missing URL parameter');
//     }

//     // Get IP and user agent info
//     const userAgent = request.headers['user-agent'] || '';
//     const ipAddress =
//       request.ip ||
//       request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
//       '';

//     // Track email click
//     await this.emailTrackingHelper.trackClick(emailId, url, {
//       userAgent,
//       ipAddress,
//       device: this.emailTrackingHelper.extractDeviceInfo(userAgent),
//     });

//     // Security check for URL to prevent open redirect vulnerabilities
//     // Only allow http:// or https:// URLs
//     if (!/^https?:\/\//i.test(url)) {
//       return res.redirect(
//         302,
//         this.configService.get('APP_URL', 'http://localhost:3000'),
//       );
//     }

//     // Redirect to the destination URL
//     return res.redirect(302, url);
//   }

//   /**
//    * Get email status
//    */
//   @ApiOperation({ summary: 'Get email status by ID' })
//   @ApiParam({ name: 'id', description: 'Email ID' })
//   @ApiResponse({
//     status: 200,
//     description: 'Returns email status',
//     schema: {
//       type: 'object',
//       properties: {
//         id: { type: 'string' },
//         status: { type: 'string' },
//         to: { type: 'string' },
//         subject: { type: 'string' },
//         sentAt: { type: 'string', format: 'date-time' },
//         openedAt: { type: 'string', format: 'date-time' },
//         clickedAt: { type: 'string', format: 'date-time' },
//       },
//     },
//   })
//   @ApiResponse({ status: 404, description: 'Email not found' })
//   @Get('status/:id')
//   async getEmailStatus(@Param('id') emailId: string) {
//     const status = await this.emailService.getEmailStatus(emailId);

//     if (!status) {
//       throw new NotFoundException('Email not found');
//     }

//     return {
//       id: status.emailId,
//       status: status.status,
//       to: status.to,
//       subject: status.subject,
//       template: status.template,
//       sentAt: status.sentAt,
//       openedAt: status.openedAt,
//       clickedAt: status.clickedAt,
//       clickUrl: status.clickUrl,
//       openCount: status.openCount,
//       clickCount: status.clickCount,
//     };
//   }

//   /**
//    * Resend a failed email
//    */
//   @ApiOperation({ summary: 'Resend a failed email' })
//   @ApiParam({ name: 'id', description: 'Email ID to resend' })
//   @ApiResponse({
//     status: 200,
//     description: 'Email resent successfully',
//     schema: {
//       type: 'object',
//       properties: {
//         success: { type: 'boolean' },
//         message: { type: 'string' },
//         newEmailId: { type: 'string' },
//       },
//     },
//   })
//   @ApiResponse({ status: 404, description: 'Email not found' })
//   @ApiBearerAuth()
//   @UseGuards(AdminGuard)
//   @Post('resend/:id')
//   async resendEmail(@Param('id') emailId: string) {
//     try {
//       const newEmailId = await this.emailService.resendEmail(emailId);

//       return {
//         success: true,
//         message: 'Email has been requeued for sending',
//         newEmailId,
//       };
//     } catch (error) {
//       throw new BadRequestException(error.message);
//     }
//   }

//   /**
//    * Generate tracking pixel
//    */
//   @ApiOperation({
//     summary: 'Generate a tracking pixel for a specific email campaign',
//   })
//   @ApiResponse({
//     status: 200,
//     description: 'Tracking pixel generated',
//     schema: {
//       type: 'object',
//       properties: {
//         html: { type: 'string' },
//         url: { type: 'string' },
//       },
//     },
//   })
//   @ApiBearerAuth()
//   @UseGuards(AdminGuard)
//   @Get('generate-pixel/:campaignId')
//   async generateTrackingPixel(@Param('campaignId') campaignId: string) {
//     // Generate a unique tracking URL for this campaign
//     const pixelUrl = `${this.configService.get('APP_URL')}/api/email/tracker/campaign/${campaignId}/open`;

//     // Return the pixel HTML
//     return {
//       html: `<img src="${pixelUrl}" alt="" width="1" height="1" style="display:none;">`,
//       url: pixelUrl,
//     };
//   }

//   /**
//    * Track campaign opens
//    */
//   @ApiOperation({ summary: 'Track campaign opens' })
//   @ApiParam({ name: 'id', description: 'Campaign ID to track' })
//   @Get('tracker/campaign/:id/open')
//   async trackCampaignOpen(
//     @Param('id') campaignId: string,
//     @Req() request: Request,
//     @Res() res: Response,
//   ) {
//     const userAgent = request.headers['user-agent'] || '';
//     const ipAddress =
//       request.ip || request.headers['x-forwarded-for']?.toString() || '';

//     // Track campaign open with enhanced analytics
//     await this.emailService.trackCampaignOpen(campaignId, {
//       userAgent,
//       ipAddress,
//       device: this.emailTrackingHelper.extractDeviceInfo(userAgent),
//     });

//     // Return a 1x1 transparent pixel
//     const pixel = Buffer.from(
//       'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
//       'base64',
//     );

//     res.setHeader('Content-Type', 'image/gif');
//     res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
//     res.setHeader('Pragma', 'no-cache');
//     res.setHeader('Expires', '0');
//     return res.send(pixel);
//   }
// }
