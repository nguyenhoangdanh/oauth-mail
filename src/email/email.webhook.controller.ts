import { Controller, Post, Get, Body, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { Inject } from '@nestjs/common';
import { EMAIL_SERVICE } from './email.di-token';
import { NodemailerService } from './nodemailer.service';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';

@ApiTags('email-webhooks')
@Controller('api/email')
export class EmailWebhookController {
  constructor(
    @Inject(EMAIL_SERVICE)
    private readonly emailService: NodemailerService,
  ) {}

  @ApiOperation({
    summary: 'Handle webhook events from email service providers',
  })
  @Post('webhook')
  async handleWebhook(@Body() payload: any) {
    // Process incoming webhooks from email providers
    if (payload.type === 'delivery-status' || payload.event === 'delivered') {
      this.emailService.processDSNNotification(payload);
    }

    return { received: true };
  }

  @ApiOperation({ summary: 'Track email opens' })
  @ApiParam({ name: 'id', description: 'Email ID to track' })
  @Get('tracker/:id/open')
  async trackOpen(@Param('id') emailId: string, @Res() res: Response) {
    // Track email opens
    if (emailId) {
      this.emailService.triggerWebhook('opened', {
        id: Math.random().toString(36).substring(2, 15),
        event: 'opened',
        emailId,
        recipient: '',
        timestamp: new Date(),
      });
    }

    // Return a 1x1 transparent pixel
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64',
    );
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(pixel);
  }

  @ApiOperation({ summary: 'Track email link clicks and redirect' })
  @ApiParam({ name: 'id', description: 'Email ID to track' })
  @ApiQuery({ name: 'url', description: 'URL to redirect to after tracking' })
  @Get('tracker/:id/click')
  async trackClick(
    @Param('id') emailId: string,
    @Query('url') url: string,
    @Res() res: Response,
  ) {
    // Track email link clicks
    if (emailId) {
      this.emailService.triggerWebhook('clicked', {
        id: Math.random().toString(36).substring(2, 15),
        event: 'clicked',
        emailId,
        recipient: '',
        timestamp: new Date(),
        metadata: { url },
      });
    }

    // Redirect to the destination URL
    if (url) {
      return res.redirect(url);
    }

    return res.status(302).send({ success: true });
  }

  @ApiOperation({ summary: 'Get email status by ID' })
  @ApiParam({ name: 'id', description: 'Email ID' })
  @Get('status/:id')
  async getEmailStatus(@Param('id') emailId: string) {
    // Check email status
    const status = this.emailService.getEmailStatus(emailId);
    if (!status) {
      return { error: 'Email not found' };
    }

    return {
      id: status.id,
      to: status.to,
      subject: status.subject,
      status: status.status,
      sentAt: status.sentAt,
      attempts: status.attempts,
    };
  }
}
