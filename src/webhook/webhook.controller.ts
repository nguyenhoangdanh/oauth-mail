// src/webhook/webhook.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { WebhookService } from './webhook.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { AdminGuard } from '../auth/guards/admin.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { EmailLog } from 'src/email/entities/email-log.entity';
import { Repository } from 'typeorm';
import { EMAIL_SERVICE } from 'src/email/email.di-token';
import { IEmailService } from 'src/email/email.port';

@ApiTags('webhooks')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('api/admin/webhooks')
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
    @InjectRepository(EmailLog)
    private readonly emailLogRepository: Repository<EmailLog>,
    @Inject(EMAIL_SERVICE)
    private readonly emailService: IEmailService,
  ) {}

  @ApiOperation({ summary: 'Get all webhook subscriptions' })
  @ApiResponse({
    status: 200,
    description: 'Returns all webhook subscriptions',
    type: [WebhookSubscription],
  })
  @Get()
  async findAll() {
    return this.webhookService.findAll();
  }

  @ApiOperation({ summary: 'Get webhook subscription by ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the webhook subscription',
    type: WebhookSubscription,
  })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const webhook = await this.webhookService.findOne(id);
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    return webhook;
  }

  @ApiOperation({ summary: 'Create a new webhook subscription' })
  @ApiResponse({
    status: 201,
    description: 'Creates a new webhook subscription',
    type: WebhookSubscription,
  })
  @Post()
  async create(@Body() createWebhookDto: CreateWebhookDto) {
    return this.webhookService.create(createWebhookDto);
  }

  @ApiOperation({ summary: 'Update a webhook subscription' })
  @ApiResponse({
    status: 200,
    description: 'Updates the webhook subscription',
    type: WebhookSubscription,
  })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateWebhookDto: UpdateWebhookDto,
  ) {
    const webhook = await this.webhookService.findOne(id);
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    return this.webhookService.update(id, updateWebhookDto);
  }

  @ApiOperation({ summary: 'Delete a webhook subscription' })
  @ApiResponse({ status: 200, description: 'Webhook deleted successfully' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const webhook = await this.webhookService.findOne(id);
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    await this.webhookService.remove(id);
    return { success: true, message: 'Webhook deleted successfully' };
  }

  @ApiOperation({ summary: 'Test a webhook subscription' })
  @ApiResponse({
    status: 200,
    description: 'Test result',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  @Post(':id/test')
  async testWebhook(@Param('id') id: string) {
    const webhook = await this.webhookService.findOne(id);
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    return this.webhookService.testWebhook(id);
  }

  @ApiOperation({ summary: 'Resend a failed email' })
  @ApiParam({ name: 'id', description: 'Email log ID to resend' })
  @Post('resend/:id')
  async resendEmail(@Param('id') id: string) {
    const emailLog = await this.emailLogRepository.findOne({ where: { id } });

    if (!emailLog) {
      return { error: 'Email not found' };
    }

    // Only allow resending failed or bounced emails
    if (!['failed', 'bounced'].includes(emailLog.status)) {
      return { error: 'Only failed or bounced emails can be resent' };
    }

    // Create a new email with the same details
    const newEmailId = await this.emailService.queueEmail(
      emailLog.to,
      emailLog.subject,
      emailLog.template,
      emailLog.context,
    );

    // Update the original email log with reference to the resend
    emailLog.resendId = newEmailId;
    await this.emailLogRepository.save(emailLog);

    return { success: true, newEmailId };
  }
}
