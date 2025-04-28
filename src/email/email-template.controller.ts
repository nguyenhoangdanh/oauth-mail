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
