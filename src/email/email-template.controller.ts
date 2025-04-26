// src/email/email-template.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
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
import { EmailTemplate } from './entities/email-template.entity';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../users/entities/user.entity';
import * as Handlebars from 'handlebars';

@ApiTags('email-templates')
@Controller('email-templates')
@UseGuards(JwtAuthGuard)
export class EmailTemplateController {
  constructor(
    @InjectRepository(EmailTemplate)
    private emailTemplateRepository: Repository<EmailTemplate>,
  ) {}

  @ApiOperation({ summary: 'Get all email templates' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of email templates',
  })
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Get()
  async getAllTemplates(
    @Query('search') search: string,
    @Query('category') category: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    const query = this.emailTemplateRepository.createQueryBuilder('template');

    // Apply filters
    if (search) {
      query.where(
        'template.name LIKE :search OR template.description LIKE :search',
        { search: `%${search}%` },
      );
    }

    if (category) {
      query.andWhere('template.category = :category', { category });
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    // Sort by latest first
    query.orderBy('template.updatedAt', 'DESC');

    // Get results and total count
    const [templates, total] = await query.getManyAndCount();

    return {
      success: true,
      templates: templates.map((template) => ({
        id: template.id,
        name: template.name,
        subject: template.subject,
        description: template.description,
        category: template.category,
        version: template.version,
        isActive: template.isActive,
        lastEditor: template.lastEditor,
        updatedAt: template.updatedAt,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @ApiOperation({ summary: 'Get email template by ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the email template',
  })
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Get(':id')
  async getTemplateById(@Param('id') id: string) {
    const template = await this.emailTemplateRepository.findOne({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return {
      success: true,
      template,
    };
  }

  @ApiOperation({ summary: 'Create a new email template' })
  @ApiResponse({
    status: 201,
    description: 'Template created successfully',
  })
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Post()
  async createTemplate(
    @Body() createTemplateDto: CreateTemplateDto,
    @GetUser() user: User,
  ) {
    // Check if name is already in use
    const existing = await this.emailTemplateRepository.findOne({
      where: { name: createTemplateDto.name },
    });

    if (existing) {
      throw new ConflictException('Template with this name already exists');
    }

    // Validate template syntax
    try {
      Handlebars.compile(createTemplateDto.content);
    } catch (error) {
      throw new BadRequestException(
        `Invalid template syntax: ${error.message}`,
      );
    }

    // Create template
    const template = this.emailTemplateRepository.create({
      ...createTemplateDto,
      lastEditor: user.email,
    });

    const savedTemplate = await this.emailTemplateRepository.save(template);

    return {
      success: true,
      message: 'Template created successfully',
      template: {
        id: savedTemplate.id,
        name: savedTemplate.name,
      },
    };
  }

  @ApiOperation({ summary: 'Update an email template' })
  @ApiResponse({
    status: 200,
    description: 'Template updated successfully',
  })
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Put(':id')
  async updateTemplate(
    @Param('id') id: string,
    @Body() updateTemplateDto: UpdateTemplateDto,
    @GetUser() user: User,
  ) {
    // Find existing template
    const template = await this.emailTemplateRepository.findOne({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // If name is changing, check if new name is already in use
    if (updateTemplateDto.name && updateTemplateDto.name !== template.name) {
      const existing = await this.emailTemplateRepository.findOne({
        where: { name: updateTemplateDto.name },
      });

      if (existing) {
        throw new ConflictException('Template with this name already exists');
      }
    }

    // Validate template syntax if content is provided
    if (updateTemplateDto.content) {
      try {
        Handlebars.compile(updateTemplateDto.content);
      } catch (error) {
        throw new BadRequestException(
          `Invalid template syntax: ${error.message}`,
        );
      }

      // Increment version when content changes
      updateTemplateDto.version = template.version + 1;
    }

    // Update template
    await this.emailTemplateRepository.update(id, {
      ...updateTemplateDto,
      lastEditor: user.email,
    });

    const updatedTemplate = await this.emailTemplateRepository.findOne({
      where: { id },
    });

    return {
      success: true,
      message: 'Template updated successfully',
      template: {
        id: updatedTemplate.id,
        name: updatedTemplate.name,
        version: updatedTemplate.version,
      },
    };
  }

  @ApiOperation({ summary: 'Delete an email template' })
  @ApiResponse({
    status: 200,
    description: 'Template deleted successfully',
  })
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Delete(':id')
  async deleteTemplate(@Param('id') id: string) {
    const template = await this.emailTemplateRepository.findOne({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    await this.emailTemplateRepository.delete(id);

    return {
      success: true,
      message: 'Template deleted successfully',
    };
  }

  @ApiOperation({ summary: 'Preview an email template' })
  @ApiResponse({
    status: 200,
    description: 'Template preview generated successfully',
  })
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Post('preview')
  async previewTemplate(
    @Body() data: { content: string; context: Record<string, any> },
  ) {
    try {
      // Validate and compile template
      const template = Handlebars.compile(data.content);

      // Add common context variables
      const fullContext = {
        ...data.context,
        appName: 'SecureMail',
        currentYear: new Date().getFullYear(),
        appUrl: 'https://example.com',
      };

      // Render HTML
      const html = template(fullContext);

      return {
        success: true,
        html,
      };
    } catch (error) {
      throw new BadRequestException(
        `Template compilation error: ${error.message}`,
      );
    }
  }

  @ApiOperation({ summary: 'Get template categories' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of categories',
  })
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Get('categories')
  async getCategories() {
    const result = await this.emailTemplateRepository
      .createQueryBuilder('template')
      .select('template.category')
      .groupBy('template.category')
      .getRawMany();

    const categories = result
      .map((item) => item.template_category)
      .filter((category) => category);

    return {
      success: true,
      categories,
    };
  }
}
// // src/email/email-template.controller.ts
// import {
//   Controller,
//   Get,
//   Post,
//   Put,
//   Delete,
//   Body,
//   Param,
//   UseGuards,
//   NotFoundException,
//   Query,
//   Inject,
//   BadRequestException,
// } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Like, Repository } from 'typeorm';
// import {
//   ApiTags,
//   ApiOperation,
//   ApiBearerAuth,
//   ApiResponse,
// } from '@nestjs/swagger';
// import { AdminGuard } from '../auth/guards/admin.guard';
// import { EmailTemplate } from './entities/email-template.entity';
// import { CreateTemplateDto } from './dto/create-template.dto';
// import { UpdateTemplateDto } from './dto/update-template.dto';
// import * as Handlebars from 'handlebars';
// import { NodemailerService } from './nodemailer.service';
// import { EMAIL_SERVICE } from './email.di-token';

// @ApiTags('email-templates')
// @ApiBearerAuth()
// @UseGuards(AdminGuard)
// @Controller('admin/email-templates')
// export class EmailTemplateController {
//   constructor(
//     @InjectRepository(EmailTemplate)
//     private readonly templateRepository: Repository<EmailTemplate>,
//     @Inject(EMAIL_SERVICE)
//     private readonly emailService: NodemailerService,
//   ) {}

//   @ApiOperation({ summary: 'Get all email templates' })
//   @ApiResponse({
//     status: 200,
//     description: 'Returns all email templates',
//     type: [EmailTemplate],
//   })
//   @Get()
//   async getAllTemplates() {
//     return this.templateRepository.find();
//   }

//   @ApiOperation({ summary: 'Get email template by ID' })
//   @ApiResponse({
//     status: 200,
//     description: 'Returns the email template',
//     type: EmailTemplate,
//   })
//   @ApiResponse({ status: 404, description: 'Template not found' })
//   @Get(':id')
//   async getTemplate(@Param('id') id: string) {
//     const template = await this.templateRepository.findOne({ where: { id } });
//     if (!template) {
//       throw new NotFoundException('Template not found');
//     }
//     return template;
//   }

//   @ApiOperation({ summary: 'Create a new email template' })
//   @ApiResponse({
//     status: 201,
//     description: 'Creates a new email template',
//     type: EmailTemplate,
//   })
//   @Post()
//   async createTemplate(@Body() templateData: CreateTemplateDto) {
//     // Validate template syntax
//     try {
//       Handlebars.compile(templateData.content);
//     } catch (error) {
//       throw new Error(`Invalid template syntax: ${error.message}`);
//     }

//     const template = this.templateRepository.create(templateData);
//     return this.templateRepository.save(template);
//   }

//   @ApiOperation({ summary: 'Update an email template' })
//   @ApiResponse({
//     status: 200,
//     description: 'Updates the email template',
//     type: EmailTemplate,
//   })
//   @ApiResponse({ status: 404, description: 'Template not found' })
//   @Put(':id')
//   async updateTemplate(
//     @Param('id') id: string,
//     @Body() templateData: UpdateTemplateDto,
//   ) {
//     // Validate template syntax if content is provided
//     if (templateData.content) {
//       try {
//         Handlebars.compile(templateData.content);
//       } catch (error) {
//         throw new Error(`Invalid template syntax: ${error.message}`);
//       }
//     }

//     const result = await this.templateRepository.update(id, templateData);
//     if (result.affected === 0) {
//       throw new NotFoundException('Template not found');
//     }
//     return this.templateRepository.findOne({ where: { id } });
//   }

//   @ApiOperation({ summary: 'Delete an email template' })
//   @ApiResponse({ status: 200, description: 'Template deleted successfully' })
//   @ApiResponse({ status: 404, description: 'Template not found' })
//   @Delete(':id')
//   async deleteTemplate(@Param('id') id: string) {
//     const result = await this.templateRepository.delete(id);
//     if (result.affected === 0) {
//       throw new NotFoundException('Template not found');
//     }
//     return { success: true, message: 'Template deleted successfully' };
//   }

//   // @ApiOperation({ summary: 'Preview email template with test data' })
//   // @ApiResponse({
//   //   status: 200,
//   //   description: 'Renders the template with provided data',
//   // })
//   // @Post('preview')
//   // async previewTemplate(@Body() data: { content: string; context: any }) {
//   //   try {
//   //     const template = Handlebars.compile(data.content);
//   //     const html = template(data.context);
//   //     return { html };
//   //   } catch (error) {
//   //     throw new Error(`Template rendering error: ${error.message}`);
//   //   }
//   // }

//   @ApiOperation({ summary: 'Get email templates with pagination and filters' })
//   @ApiResponse({ status: 200, description: 'Returns templates' })
//   @Get('paginated')
//   async getTemplatesPaginated(
//     @Query()
//     params: {
//       page?: number;
//       limit?: number;
//       search?: string;
//       isActive?: boolean;
//     },
//   ) {
//     const { page = 1, limit = 10, search = '', isActive } = params;
//     const skip = (page - 1) * limit;

//     // Build query conditions
//     const whereClause: any = {};

//     if (search) {
//       whereClause.name = Like(`%${search}%`);
//     }

//     if (isActive !== undefined) {
//       whereClause.isActive = isActive;
//     }

//     const [templates, total] = await this.templateRepository.findAndCount({
//       where: whereClause,
//       order: { updatedAt: 'DESC' },
//       skip,
//       take: limit,
//     });

//     return {
//       data: templates,
//       meta: {
//         total,
//         page: +page,
//         limit: +limit,
//         pages: Math.ceil(total / limit),
//       },
//     };
//   }

//   @ApiOperation({ summary: 'Render template with test data' })
//   @ApiResponse({ status: 200, description: 'Returns rendered HTML' })
//   @Post(':id/preview')
//   async previewTemplate(
//     @Param('id') id: string,
//     @Body() testData: Record<string, any>,
//   ) {
//     const template = await this.templateRepository.findOne({
//       where: { id },
//     });

//     if (!template) {
//       throw new NotFoundException('Template not found');
//     }

//     // Use the existing template renderer from the email service
//     // This is a simplified version - in a real app, you'd inject the email service
//     const handlebarsTemplate = Handlebars.compile(template.content);
//     const renderedHtml = handlebarsTemplate({
//       ...testData,
//       currentYear: new Date().getFullYear(),
//     });

//     return { html: renderedHtml };
//   }
//   @ApiOperation({ summary: 'Send a test email using a template' })
//   @ApiResponse({ status: 200, description: 'Test email sent' })
//   @Post(':id/test')
//   async sendTestEmail(
//     @Param('id') id: string,
//     @Body() testData: { recipient: string; data?: Record<string, any> },
//   ) {
//     const template = await this.templateRepository.findOne({
//       where: { id },
//     });

//     if (!template) {
//       throw new NotFoundException('Template not found');
//     }

//     if (!testData.recipient) {
//       throw new BadRequestException('Recipient email is required');
//     }

//     // Send test email using the template and provided data
//     // This would call your email service
//     const emailId = await this.emailService.queueEmail(
//       testData.recipient,
//       template.subject || `Test: ${template.name}`,
//       template.name,
//       {
//         ...testData.data,
//         _test: true, // Mark as test email
//       },
//     );

//     return {
//       success: true,
//       message: 'Test email sent successfully',
//       emailId,
//     };
//   }
// }
