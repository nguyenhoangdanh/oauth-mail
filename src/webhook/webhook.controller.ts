// src/webhook/webhook.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WebhookService } from './webhook.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('webhooks')
@Controller('webhooks')
@UseGuards(JwtAuthGuard)
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @ApiOperation({ summary: 'Create a new webhook subscription' })
  @ApiResponse({
    status: 201,
    description: 'Webhook subscription created successfully',
  })
  @ApiBearerAuth()
  @Post()
  async create(
    @Body() createWebhookDto: CreateWebhookDto,
    @GetUser() user: User,
  ) {
    try {
      const webhook = await this.webhookService.create(
        createWebhookDto,
        user.id,
      );

      return {
        success: true,
        message: 'Webhook subscription created successfully',
        webhook: {
          id: webhook.id,
          name: webhook.name,
          event: webhook.event,
          endpoint: webhook.endpoint,
          secret: webhook.secret,
        },
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to create webhook: ${error.message}`,
      );
    }
  }

  @ApiOperation({ summary: 'Get all webhook subscriptions' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of webhook subscriptions',
  })
  @ApiBearerAuth()
  @Get()
  async findAll(@GetUser() user: User) {
    // For admin users, get all webhooks
    // For regular users, get only their webhooks
    const isAdmin = user.roles.includes('admin');

    try {
      const webhooks = await this.webhookService.findAll(
        isAdmin ? undefined : user.id,
      );

      return {
        success: true,
        webhooks: webhooks.map((webhook) => ({
          id: webhook.id,
          name: webhook.name,
          event: webhook.event,
          endpoint: webhook.endpoint,
          isActive: webhook.isActive,
          createdAt: webhook.createdAt,
          successCount: webhook.successCount,
          failedAttempts: webhook.failedAttempts,
          lastSuccess: webhook.lastSuccess,
          lastFailure: webhook.lastFailure,
        })),
      };
    } catch (error) {
      throw new BadRequestException(`Failed to get webhooks: ${error.message}`);
    }
  }

  @ApiOperation({ summary: 'Get a webhook subscription by ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the webhook subscription',
  })
  @ApiBearerAuth()
  @Get(':id')
  async findOne(@Param('id') id: string, @GetUser() user: User) {
    // For admin users, get any webhook
    // For regular users, get only their webhooks
    const isAdmin = user.roles.includes('admin');

    try {
      const webhook = await this.webhookService.findOne(
        id,
        isAdmin ? undefined : user.id,
      );

      if (!webhook) {
        throw new NotFoundException('Webhook not found');
      }

      return {
        success: true,
        webhook,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to get webhook: ${error.message}`);
    }
  }

  @ApiOperation({ summary: 'Update a webhook subscription' })
  @ApiResponse({
    status: 200,
    description: 'Webhook subscription updated successfully',
  })
  @ApiBearerAuth()
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateWebhookDto: UpdateWebhookDto,
    @GetUser() user: User,
  ) {
    // For admin users, update any webhook
    // For regular users, update only their webhooks
    const isAdmin = user.roles.includes('admin');

    try {
      const webhook = await this.webhookService.update(
        id,
        updateWebhookDto,
        isAdmin ? undefined : user.id,
      );

      return {
        success: true,
        message: 'Webhook subscription updated successfully',
        webhook: {
          id: webhook.id,
          name: webhook.name,
          event: webhook.event,
          endpoint: webhook.endpoint,
          isActive: webhook.isActive,
        },
      };
    } catch (error) {
      if (error.message === 'Webhook not found') {
        throw new NotFoundException('Webhook not found');
      }
      throw new BadRequestException(
        `Failed to update webhook: ${error.message}`,
      );
    }
  }

  @ApiOperation({ summary: 'Delete a webhook subscription' })
  @ApiResponse({
    status: 200,
    description: 'Webhook subscription deleted successfully',
  })
  @ApiBearerAuth()
  @Delete(':id')
  async remove(@Param('id') id: string, @GetUser() user: User) {
    // For admin users, delete any webhook
    // For regular users, delete only their webhooks
    const isAdmin = user.roles.includes('admin');

    try {
      await this.webhookService.remove(id, isAdmin ? undefined : user.id);

      return {
        success: true,
        message: 'Webhook subscription deleted successfully',
      };
    } catch (error) {
      if (error.message === 'Webhook not found') {
        throw new NotFoundException('Webhook not found');
      }
      throw new BadRequestException(
        `Failed to delete webhook: ${error.message}`,
      );
    }
  }

  @ApiOperation({ summary: 'Get webhook delivery logs' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of webhook delivery logs',
  })
  @ApiBearerAuth()
  @Get(':id/logs')
  async getLogs(
    @Param('id') id: string,
    @Query('limit') limit = 20,
    @GetUser() user: User,
  ) {
    // For admin users, get logs for any webhook
    // For regular users, get logs only for their webhooks
    const isAdmin = user.roles.includes('admin');

    try {
      // First check if the webhook exists and belongs to the user
      const webhook = await this.webhookService.findOne(
        id,
        isAdmin ? undefined : user.id,
      );

      if (!webhook) {
        throw new NotFoundException('Webhook not found');
      }

      const logs = await this.webhookService.getDeliveryLogs(id, limit);

      return {
        success: true,
        logs: logs.map((log) => ({
          id: log.id,
          event: log.event,
          status: log.status,
          attempt: log.attempt,
          statusCode: log.statusCode,
          createdAt: log.createdAt,
          completedAt: log.completedAt,
          duration: log.duration,
        })),
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to get webhook logs: ${error.message}`,
      );
    }
  }

  @ApiOperation({ summary: 'Retry a failed webhook delivery' })
  @ApiResponse({
    status: 200,
    description: 'Webhook delivery queued for retry',
  })
  @ApiBearerAuth()
  @Post('logs/:id/retry')
  async retryDelivery(@Param('id') id: string, @GetUser() user: User) {
    const isAdmin = user.roles.includes('admin');

    if (!isAdmin) {
      throw new ForbiddenException(
        'Only admin users can retry webhook deliveries',
      );
    }

    try {
      await this.webhookService.retryDelivery(id);

      return {
        success: true,
        message: 'Webhook delivery queued for retry',
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to retry webhook delivery: ${error.message}`,
      );
    }
  }

  @ApiOperation({ summary: 'Get supported webhook events' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of supported webhook events',
  })
  @ApiBearerAuth()
  @Get('events/supported')
  getSupportedEvents() {
    const events = this.webhookService.getSupportedEvents();

    return {
      success: true,
      events,
    };
  }
}

// // src/webhook/webhook.controller.ts
// import {
//   Controller,
//   Get,
//   Post,
//   Body,
//   Param,
//   Delete,
//   Put,
//   UseGuards,
//   NotFoundException,
//   Query,
//   BadRequestException,
//   HttpStatus,
//   HttpCode,
// } from '@nestjs/common';
// import {
//   ApiTags,
//   ApiOperation,
//   ApiBearerAuth,
//   ApiResponse,
//   ApiParam,
//   ApiQuery,
// } from '@nestjs/swagger';
// import { WebhookService } from './webhook.service';
// import { CreateWebhookDto } from './dto/create-webhook.dto';
// import { UpdateWebhookDto } from './dto/update-webhook.dto';
// import { WebhookSubscription } from './entities/webhook-subscription.entity';
// import { AdminGuard } from '../auth/guards/admin.guard';
// import { WebhookDeliveryLogDto } from './dto/webhook-delivery-log.dto';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { WebhookDeliveryLog } from './entities/webhook-delivery-log.entity';

// @ApiTags('webhooks')
// @ApiBearerAuth()
// @UseGuards(AdminGuard)
// @Controller('admin/webhooks')
// export class WebhookController {
//   constructor(
//     private readonly webhookService: WebhookService,
//     @InjectRepository(WebhookDeliveryLog)
//     private readonly deliveryLogRepository: Repository<WebhookDeliveryLog>,
//   ) {}

//   @ApiOperation({ summary: 'Get all webhook subscriptions' })
//   @ApiResponse({
//     status: 200,
//     description: 'Returns all webhook subscriptions',
//     type: [WebhookSubscription],
//   })
//   @ApiQuery({
//     name: 'event',
//     required: false,
//     description: 'Filter by event type',
//   })
//   @ApiQuery({
//     name: 'active',
//     required: false,
//     description: 'Filter by active status (true/false)',
//   })
//   @Get()
//   async findAll(
//     @Query('event') event?: string,
//     @Query('active') active?: string,
//   ) {
//     const filters: any = {};

//     if (event) {
//       filters.event = event;
//     }

//     if (active !== undefined) {
//       filters.isActive = active === 'true';
//     }

//     if (Object.keys(filters).length > 0) {
//       return this.webhookService.findByFilters(filters);
//     }

//     return this.webhookService.findAll();
//   }

//   @ApiOperation({ summary: 'Get webhook subscription by ID' })
//   @ApiResponse({
//     status: 200,
//     description: 'Returns the webhook subscription',
//     type: WebhookSubscription,
//   })
//   @ApiResponse({ status: 404, description: 'Webhook not found' })
//   @ApiParam({ name: 'id', description: 'Webhook ID' })
//   @Get(':id')
//   async findOne(@Param('id') id: string) {
//     const webhook = await this.webhookService.findOne(id);
//     if (!webhook) {
//       throw new NotFoundException('Webhook not found');
//     }
//     return webhook;
//   }

//   @ApiOperation({ summary: 'Create a new webhook subscription' })
//   @ApiResponse({
//     status: 201,
//     description: 'Creates a new webhook subscription',
//     type: WebhookSubscription,
//   })
//   @Post()
//   async create(@Body() createWebhookDto: CreateWebhookDto) {
//     return this.webhookService.create(createWebhookDto);
//   }

//   @ApiOperation({ summary: 'Update a webhook subscription' })
//   @ApiResponse({
//     status: 200,
//     description: 'Updates the webhook subscription',
//     type: WebhookSubscription,
//   })
//   @ApiResponse({ status: 404, description: 'Webhook not found' })
//   @ApiParam({ name: 'id', description: 'Webhook ID' })
//   @Put(':id')
//   async update(
//     @Param('id') id: string,
//     @Body() updateWebhookDto: UpdateWebhookDto,
//   ) {
//     const webhook = await this.webhookService.findOne(id);
//     if (!webhook) {
//       throw new NotFoundException('Webhook not found');
//     }
//     return this.webhookService.update(id, updateWebhookDto);
//   }

//   @ApiOperation({ summary: 'Delete a webhook subscription' })
//   @ApiResponse({ status: 200, description: 'Webhook deleted successfully' })
//   @ApiResponse({ status: 404, description: 'Webhook not found' })
//   @ApiParam({ name: 'id', description: 'Webhook ID' })
//   @Delete(':id')
//   @HttpCode(HttpStatus.OK)
//   async remove(@Param('id') id: string) {
//     const webhook = await this.webhookService.findOne(id);
//     if (!webhook) {
//       throw new NotFoundException('Webhook not found');
//     }
//     await this.webhookService.remove(id);
//     return { success: true, message: 'Webhook deleted successfully' };
//   }

//   @ApiOperation({ summary: 'Test a webhook subscription' })
//   @ApiResponse({
//     status: 200,
//     description: 'Test result',
//     schema: {
//       type: 'object',
//       properties: {
//         success: { type: 'boolean' },
//         message: { type: 'string' },
//         details: { type: 'object' },
//       },
//     },
//   })
//   @ApiResponse({ status: 404, description: 'Webhook not found' })
//   @ApiParam({ name: 'id', description: 'Webhook ID' })
//   @Post(':id/test')
//   async testWebhook(@Param('id') id: string) {
//     const webhook = await this.webhookService.findOne(id);
//     if (!webhook) {
//       throw new NotFoundException('Webhook not found');
//     }
//     return this.webhookService.testWebhook(id);
//   }

//   @ApiOperation({ summary: 'Get webhook delivery logs' })
//   @ApiResponse({
//     status: 200,
//     description: 'Returns webhook delivery logs',
//     type: [WebhookDeliveryLogDto],
//   })
//   @ApiParam({ name: 'id', description: 'Webhook ID' })
//   @ApiQuery({
//     name: 'page',
//     required: false,
//     description: 'Page number',
//     type: Number,
//   })
//   @ApiQuery({
//     name: 'limit',
//     required: false,
//     description: 'Items per page',
//     type: Number,
//   })
//   @ApiQuery({
//     name: 'status',
//     required: false,
//     description: 'Filter by status (success/failed/pending)',
//   })
//   @Get(':id/logs')
//   async getWebhookLogs(
//     @Param('id') id: string,
//     @Query('page') page = 1,
//     @Query('limit') limit = 20,
//     @Query('status') status?: string,
//   ) {
//     const webhook = await this.webhookService.findOne(id);
//     if (!webhook) {
//       throw new NotFoundException('Webhook not found');
//     }

//     const filters: any = { webhookId: id };
//     if (status) {
//       filters.status = status;
//     }

//     const [logs, total] = await this.deliveryLogRepository.findAndCount({
//       where: filters,
//       order: { createdAt: 'DESC' },
//       skip: (page - 1) * limit,
//       take: limit,
//     });

//     return {
//       data: logs,
//       meta: {
//         total,
//         page: +page,
//         limit: +limit,
//         pages: Math.ceil(total / limit),
//       },
//     };
//   }

//   @ApiOperation({ summary: 'Reset webhook failure count' })
//   @ApiResponse({
//     status: 200,
//     description: 'Webhook failure count reset successfully',
//     type: WebhookSubscription,
//   })
//   @ApiResponse({ status: 404, description: 'Webhook not found' })
//   @ApiParam({ name: 'id', description: 'Webhook ID' })
//   @Post(':id/reset-failures')
//   async resetFailureCount(@Param('id') id: string) {
//     const webhook = await this.webhookService.findOne(id);
//     if (!webhook) {
//       throw new NotFoundException('Webhook not found');
//     }

//     return this.webhookService.resetFailureCount(id);
//   }

//   @ApiOperation({ summary: 'Retry a failed webhook delivery' })
//   @ApiResponse({
//     status: 200,
//     description: 'Webhook delivery retry initiated',
//     schema: {
//       type: 'object',
//       properties: {
//         success: { type: 'boolean' },
//         message: { type: 'string' },
//       },
//     },
//   })
//   @ApiResponse({ status: 404, description: 'Webhook delivery log not found' })
//   @ApiParam({ name: 'id', description: 'Webhook Delivery Log ID' })
//   @Post('logs/:id/retry')
//   async retryDelivery(@Param('id') id: string) {
//     const deliveryLog = await this.deliveryLogRepository.findOne({
//       where: { id },
//     });
//     if (!deliveryLog) {
//       throw new NotFoundException('Webhook delivery log not found');
//     }

//     if (deliveryLog.status !== 'failed') {
//       throw new BadRequestException('Only failed deliveries can be retried');
//     }

//     const webhook = await this.webhookService.findOne(deliveryLog.webhookId);
//     if (!webhook) {
//       throw new NotFoundException('Webhook not found');
//     }

//     if (!webhook.isActive) {
//       throw new BadRequestException(
//         'Cannot retry delivery for inactive webhook',
//       );
//     }

//     return this.webhookService.retryDelivery(deliveryLog);
//   }

//   @ApiOperation({ summary: 'Get webhook events' })
//   @ApiResponse({
//     status: 200,
//     description: 'Returns available webhook event types',
//     schema: {
//       type: 'object',
//       properties: {
//         events: {
//           type: 'array',
//           items: {
//             type: 'object',
//             properties: {
//               name: { type: 'string' },
//               description: { type: 'string' },
//             },
//           },
//         },
//       },
//     },
//   })
//   @Get('events')
//   getWebhookEvents() {
//     return {
//       events: [
//         { name: 'sent', description: 'Triggered when an email is sent' },
//         {
//           name: 'delivered',
//           description: 'Triggered when an email is delivered',
//         },
//         { name: 'opened', description: 'Triggered when an email is opened' },
//         {
//           name: 'clicked',
//           description: 'Triggered when a link in an email is clicked',
//         },
//         { name: 'bounced', description: 'Triggered when an email bounces' },
//         {
//           name: 'complained',
//           description: 'Triggered when a recipient marks the email as spam',
//         },
//         {
//           name: 'failed',
//           description: 'Triggered when an email fails to send',
//         },
//       ],
//     };
//   }
// }
