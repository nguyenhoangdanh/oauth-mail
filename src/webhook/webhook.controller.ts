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
  Query,
  BadRequestException,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { WebhookService } from './webhook.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { AdminGuard } from '../auth/guards/admin.guard';
import { WebhookDeliveryLogDto } from './dto/webhook-delivery-log.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookDeliveryLog } from './entities/webhook-delivery-log.entity';

@ApiTags('webhooks')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/webhooks')
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
    @InjectRepository(WebhookDeliveryLog)
    private readonly deliveryLogRepository: Repository<WebhookDeliveryLog>,
  ) {}

  @ApiOperation({ summary: 'Get all webhook subscriptions' })
  @ApiResponse({
    status: 200,
    description: 'Returns all webhook subscriptions',
    type: [WebhookSubscription],
  })
  @ApiQuery({ name: 'event', required: false, description: 'Filter by event type' })
  @ApiQuery({ name: 'active', required: false, description: 'Filter by active status (true/false)' })
  @Get()
  async findAll(
    @Query('event') event?: string,
    @Query('active') active?: string,
  ) {
    const filters: any = {};
    
    if (event) {
      filters.event = event;
    }
    
    if (active !== undefined) {
      filters.isActive = active === 'true';
    }
    
    if (Object.keys(filters).length > 0) {
      return this.webhookService.findByFilters(filters);
    }
    
    return this.webhookService.findAll();
  }

  @ApiOperation({ summary: 'Get webhook subscription by ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the webhook subscription',
    type: WebhookSubscription,
  })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  @ApiParam({ name: 'id', description: 'Webhook ID' })
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
  @ApiParam({ name: 'id', description: 'Webhook ID' })
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
  @ApiParam({ name: 'id', description: 'Webhook ID' })
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
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
        details: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  @ApiParam({ name: 'id', description: 'Webhook ID' })
  @Post(':id/test')
  async testWebhook(@Param('id') id: string) {
    const webhook = await this.webhookService.findOne(id);
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    return this.webhookService.testWebhook(id);
  }

  @ApiOperation({ summary: 'Get webhook delivery logs' })
  @ApiResponse({
    status: 200,
    description: 'Returns webhook delivery logs',
    type: [WebhookDeliveryLogDto],
  })
  @ApiParam({ name: 'id', description: 'Webhook ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', type: Number })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', type: Number })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status (success/failed/pending)' })
  @Get(':id/logs')
  async getWebhookLogs(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
  ) {
    const webhook = await this.webhookService.findOne(id);
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    
    const filters: any = { webhookId: id };
    if (status) {
      filters.status = status;
    }
    
    const [logs, total] = await this.deliveryLogRepository.findAndCount({
      where: filters,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    
    return {
      data: logs,
      meta: {
        total,
        page: +page,
        limit: +limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  @ApiOperation({ summary: 'Reset webhook failure count' })
  @ApiResponse({
    status: 200,
    description: 'Webhook failure count reset successfully',
    type: WebhookSubscription,
  })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  @ApiParam({ name: 'id', description: 'Webhook ID' })
  @Post(':id/reset-failures')
  async resetFailureCount(@Param('id') id: string) {
    const webhook = await this.webhookService.findOne(id);
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    
    return this.webhookService.resetFailureCount(id);
  }

  @ApiOperation({ summary: 'Retry a failed webhook delivery' })
  @ApiResponse({
    status: 200,
    description: 'Webhook delivery retry initiated',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Webhook delivery log not found' })
  @ApiParam({ name: 'id', description: 'Webhook Delivery Log ID' })
  @Post('logs/:id/retry')
  async retryDelivery(@Param('id') id: string) {
    const deliveryLog = await this.deliveryLogRepository.findOne({ where: { id } });
    if (!deliveryLog) {
      throw new NotFoundException('Webhook delivery log not found');
    }
    
    if (deliveryLog.status !== 'failed') {
      throw new BadRequestException('Only failed deliveries can be retried');
    }
    
    const webhook = await this.webhookService.findOne(deliveryLog.webhookId);
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    
    if (!webhook.isActive) {
      throw new BadRequestException('Cannot retry delivery for inactive webhook');
    }
    
    return this.webhookService.retryDelivery(deliveryLog);
  }
  
  @ApiOperation({ summary: 'Get webhook events' })
  @ApiResponse({
    status: 200,
    description: 'Returns available webhook event types',
    schema: {
      type: 'object',
      properties: {
        events: { 
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @Get('events')
  getWebhookEvents() {
    return {
      events: [
        { name: 'sent', description: 'Triggered when an email is sent' },
        { name: 'delivered', description: 'Triggered when an email is delivered' },
        { name: 'opened', description: 'Triggered when an email is opened' },
        { name: 'clicked', description: 'Triggered when a link in an email is clicked' },
        { name: 'bounced', description: 'Triggered when an email bounces' },
        { name: 'complained', description: 'Triggered when a recipient marks the email as spam' },
        { name: 'failed', description: 'Triggered when an email fails to send' },
      ],
    };
  }
}