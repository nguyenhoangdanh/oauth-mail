// src/email/email.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { Inject } from '@nestjs/common';
import { EMAIL_SERVICE } from './email.di-token';
import { IEmailService } from './email.port';
import {
  SendEmailDto,
  VerificationEmailDto,
  PasswordResetEmailDto,
} from './dto/send-email.dto';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('email')
@Controller('api/email')
export class EmailController {
  constructor(
    @Inject(EMAIL_SERVICE)
    private readonly emailService: IEmailService,
  ) {}

  @ApiOperation({ summary: 'Send a verification email' })
  @ApiResponse({ status: 201, description: 'Email sent successfully' })
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Post('send-verification')
  async sendVerificationEmail(@Body() emailDto: VerificationEmailDto) {
    await this.emailService.sendVerificationEmail(
      emailDto.to,
      emailDto.name,
      emailDto.token,
    );
    return { success: true, message: 'Verification email sent' };
  }

  @ApiOperation({ summary: 'Send a password reset email' })
  @ApiResponse({ status: 201, description: 'Email sent successfully' })
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Post('send-password-reset')
  async sendPasswordResetEmail(@Body() emailDto: PasswordResetEmailDto) {
    await this.emailService.sendPasswordResetEmail(
      emailDto.to,
      emailDto.name,
      emailDto.token,
    );
    return { success: true, message: 'Password reset email sent' };
  }

  @ApiOperation({ summary: 'Send a welcome email' })
  @ApiResponse({ status: 201, description: 'Email sent successfully' })
  @ApiBearerAuth()
  // @UseGuards(AdminGuard)
  @Post('send-welcome')
  async sendWelcomeEmail(@Body() emailDto: { to: string; name?: string }) {
    await this.emailService.sendWelcomeEmail(emailDto.to, emailDto.name);
    return { success: true, message: 'Welcome email sent' };
  }

  @ApiOperation({ summary: 'Send a custom email using any template' })
  @ApiResponse({ status: 201, description: 'Email sent successfully' })
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Post('send')
  async sendCustomEmail(@Body() emailDto: SendEmailDto) {
    const emailId = await (this.emailService as any).queueEmail(
      emailDto.to,
      emailDto.subject,
      emailDto.template,
      emailDto.context,
    );
    return {
      success: true,
      message: 'Email queued successfully',
      emailId,
    };
  }

  @ApiOperation({ summary: 'Track email clicks with additional metadata' })
  @ApiResponse({ status: 200, description: 'Click tracked' })
  @Get('tracker/:id/enhanced-click')
  async trackEnhancedClick(
    @Param('id') emailId: string,
    @Query() query: { url: string; deviceInfo?: string; location?: string },
    @Req() request: Request,
    @Res() res: Response,
  ) {
    // Extract user agent and IP information
    const userAgent = request.headers['user-agent'] || '';
    const ip = request.ip || request.headers['x-forwarded-for'] || '';

    // Track with enhanced data
    if (emailId) {
      this.emailService.triggerWebhook('clicked', {
        id: uuidv4(),
        event: 'clicked',
        emailId,
        recipient: '',
        timestamp: new Date(),
        metadata: {
          url: query.url,
          userAgent,
          ip,
          deviceInfo: query.deviceInfo,
          location: query.location,
        },
      });
    }

    // Safe redirect handling with validation
    if (query.url) {
      // Validate URL to prevent open redirect vulnerabilities
      const isValidUrl = /^https?:\/\//.test(query.url);

      if (isValidUrl) {
        return res.redirect(302, query.url);
      }
    }

    // If URL is invalid or not provided, redirect to a safe default
    return res.redirect(302, '/');
  }

  @ApiOperation({
    summary: 'Generate a tracking pixel for a specific email campaign',
  })
  @ApiResponse({ status: 200, description: 'Tracking pixel generated' })
  @Get('generate-pixel/:campaignId')
  async generateTrackingPixel(@Param('campaignId') campaignId: string) {
    // Generate a unique tracking URL for this campaign
    const pixelUrl = `${this.configService.get('APP_URL')}/api/email/tracker/campaign/${campaignId}/open`;

    // Return the pixel HTML
    return {
      html: `<img src="${pixelUrl}" alt="" width="1" height="1" style="display:none;">`,
      url: pixelUrl,
    };
  }

  @ApiOperation({ summary: 'Track campaign opens' })
  @ApiParam({ name: 'id', description: 'Campaign ID to track' })
  @Get('tracker/campaign/:id/open')
  async trackCampaignOpen(
    @Param('id') campaignId: string,
    @Req() request: Request,
    @Res() res: Response,
  ) {
    const userAgent = request.headers['user-agent'] || '';
    const ip = request.ip || request.headers['x-forwarded-for'] || '';

    // Track campaign opens with enhanced analytics
    this.emailService.trackCampaignOpen(campaignId, { userAgent, ip });

    // Return a 1x1 transparent pixel
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64',
    );
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(pixel);
  }
}
