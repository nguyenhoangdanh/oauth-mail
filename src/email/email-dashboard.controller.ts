import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AdminGuard } from '../auth/guards/admin.guard';
import { EmailLog } from './entities/email-log.entity';
import { EmailEvent } from './entities/email-event.entity';
import { EmailStats } from './entities/email-stats.entity';
import { EmailFiltersDto } from './dto/email-filters.dto';
import { DateRangeDto } from './dto/date-range.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('email-dashboard')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/email-dashboard')
export class EmailDashboardController {
  constructor(
    @InjectRepository(EmailLog)
    private readonly emailLogRepository: Repository<EmailLog>,
    @InjectRepository(EmailEvent)
    private readonly emailEventRepository: Repository<EmailEvent>,
    @InjectRepository(EmailStats)
    private readonly emailStatsRepository: Repository<EmailStats>,
  ) {}

  @ApiOperation({ summary: 'Get email dashboard overview' })
  @ApiResponse({
    status: 200,
    description: 'Returns email statistics overview',
  })
  @Get('overview')
  async getOverview(@Query() dateRange: DateRangeDto) {
    const { start, end } = this.getDateRange(dateRange);

    // Lấy tổng số email theo trạng thái
    const [
      totalCount,
      sentCount,
      deliveredCount,
      openedCount,
      clickedCount,
      bouncedCount,
      failedCount,
    ] = await Promise.all([
      this.emailLogRepository.count({
        where: { createdAt: Between(start, end) },
      }),
      this.emailLogRepository.count({
        where: { status: 'sent', createdAt: Between(start, end) },
      }),
      this.emailLogRepository.count({
        where: { status: 'delivered', createdAt: Between(start, end) },
      }),
      this.emailLogRepository.count({
        where: { status: 'opened', createdAt: Between(start, end) },
      }),
      this.emailLogRepository.count({
        where: { status: 'clicked', createdAt: Between(start, end) },
      }),
      this.emailLogRepository.count({
        where: { status: 'bounced', createdAt: Between(start, end) },
      }),
      this.emailLogRepository.count({
        where: { status: 'failed', createdAt: Between(start, end) },
      }),
    ]);

    // Tính tỷ lệ
    const deliveryRate =
      totalCount > 0 ? (deliveredCount / totalCount) * 100 : 0;
    const openRate =
      deliveredCount > 0 ? (openedCount / deliveredCount) * 100 : 0;
    const clickRate = openedCount > 0 ? (clickedCount / openedCount) * 100 : 0;
    const bounceRate = totalCount > 0 ? (bouncedCount / totalCount) * 100 : 0;
    const failureRate = totalCount > 0 ? (failedCount / totalCount) * 100 : 0;

    return {
      period: {
        start,
        end,
      },
      metrics: {
        total: totalCount,
        sent: sentCount,
        delivered: deliveredCount,
        opened: openedCount,
        clicked: clickedCount,
        bounced: bouncedCount,
        failed: failedCount,
      },
      rates: {
        delivery: parseFloat(deliveryRate.toFixed(2)),
        open: parseFloat(openRate.toFixed(2)),
        click: parseFloat(clickRate.toFixed(2)),
        bounce: parseFloat(bounceRate.toFixed(2)),
        failure: parseFloat(failureRate.toFixed(2)),
      },
    };
  }

  @ApiOperation({ summary: 'Get daily statistics' })
  @ApiResponse({ status: 200, description: 'Returns daily email statistics' })
  @Get('daily-stats')
  async getDailyStats(@Query() dateRange: DateRangeDto) {
    const { start, end } = this.getDateRange(dateRange);

    // Lấy số liệu theo ngày
    const stats = await this.emailStatsRepository.find({
      where: { date: Between(start, end) },
      order: { date: 'ASC' },
    });

    // Nếu không có dữ liệu, tạo dữ liệu từ email_logs
    if (stats.length === 0) {
      return this.generateDailyStatsFromLogs(start, end);
    }

    return stats;
  }

  @ApiOperation({ summary: 'Get template performance metrics' })
  @ApiResponse({
    status: 200,
    description: 'Returns performance metrics by template',
  })
  @Get('template-performance')
  async getTemplatePerformance(@Query() dateRange: DateRangeDto) {
    const { start, end } = this.getDateRange(dateRange);

    // Lấy hiệu suất theo template
    const templateStats = await this.emailLogRepository.query(
      `
      SELECT 
        template, 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'opened' THEN 1 ELSE 0 END) as opened,
        SUM(CASE WHEN status = 'clicked' THEN 1 ELSE 0 END) as clicked,
        SUM(CASE WHEN status = 'bounced' THEN 1 ELSE 0 END) as bounced,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        AVG(CASE WHEN openedAt IS NOT NULL THEN EXTRACT(EPOCH FROM (openedAt - sentAt))/60 ELSE NULL END) as avg_open_time_mins,
        AVG(CASE WHEN clickedAt IS NOT NULL THEN EXTRACT(EPOCH FROM (clickedAt - openedAt))/60 ELSE NULL END) as avg_click_time_mins
      FROM email_logs
      WHERE createdAt BETWEEN $1 AND $2
      GROUP BY template
      ORDER BY total DESC
    `,
      [start, end],
    );

    // Thêm tỷ lệ cho mỗi template
    return templateStats.map((template) => ({
      ...template,
      rates: {
        delivery:
          template.total > 0
            ? parseFloat(
                ((template.delivered / template.total) * 100).toFixed(2),
              )
            : 0,
        open:
          template.delivered > 0
            ? parseFloat(
                ((template.opened / template.delivered) * 100).toFixed(2),
              )
            : 0,
        click:
          template.opened > 0
            ? parseFloat(
                ((template.clicked / template.opened) * 100).toFixed(2),
              )
            : 0,
        bounce:
          template.total > 0
            ? parseFloat(((template.bounced / template.total) * 100).toFixed(2))
            : 0,
        failure:
          template.total > 0
            ? parseFloat(((template.failed / template.total) * 100).toFixed(2))
            : 0,
      },
    }));
  }

  @ApiOperation({ summary: 'Get email logs with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Returns email logs' })
  @Get('logs')
  async getEmailLogs(@Query() filters: EmailFiltersDto) {
    const { page, limit, status, template, search, start, end } = filters;
    const skip = (page - 1) * limit;
    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : null;

    // Xây dựng điều kiện truy vấn
    const whereClause: any = {};

    if (status) {
      whereClause.status = status;
    }

    if (template) {
      whereClause.template = template;
    }

    if (search) {
      whereClause.to = search;
    }

    if (startDate && endDate) {
      whereClause.createdAt = Between(startDate, endDate);
    }

    // Lấy dữ liệu và tổng số
    const [logs, total] = await this.emailLogRepository.findAndCount({
      where: whereClause,
      order: { createdAt: 'DESC' },
      skip,
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

  @ApiOperation({ summary: 'Get email log details by ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns email log details and events',
  })
  @ApiResponse({ status: 404, description: 'Email log not found' })
  @Get('logs/:id')
  async getEmailLogDetail(@Param('id') id: string) {
    // Lấy chi tiết email log
    const log = await this.emailLogRepository.findOne({ where: { id } });

    if (!log) {
      return { error: 'Email log not found' };
    }

    // Lấy tất cả sự kiện của email này
    const events = await this.emailEventRepository.find({
      where: { emailId: log.emailId },
      order: { timestamp: 'ASC' },
    });

    return {
      log,
      events,
    };
  }

  private getDateRange(dateRange: DateRangeDto): { start: Date; end: Date } {
    const start = dateRange.start
      ? new Date(dateRange.start)
      : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = dateRange.end ? new Date(dateRange.end) : new Date();

    return { start, end };
  }

  private async generateDailyStatsFromLogs(start: Date, end: Date) {
    const dailyStats = [];

    // Clone start date
    const currentDate = new Date(start);

    // Lặp qua mỗi ngày
    while (currentDate <= end) {
      const dayStart = new Date(currentDate);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      // Lấy số liệu cho ngày hiện tại
      const [sent, delivered, opened, clicked, bounced, failed] =
        await Promise.all([
          this.emailLogRepository.count({
            where: {
              status: 'sent',
              sentAt: Between(dayStart, dayEnd),
            },
          }),
          this.emailLogRepository.count({
            where: {
              status: 'delivered',
              lastStatusAt: Between(dayStart, dayEnd),
            },
          }),
          this.emailLogRepository.count({
            where: {
              status: 'opened',
              openedAt: Between(dayStart, dayEnd),
            },
          }),
          this.emailLogRepository.count({
            where: {
              status: 'clicked',
              clickedAt: Between(dayStart, dayEnd),
            },
          }),
          this.emailLogRepository.count({
            where: {
              status: 'bounced',
              lastStatusAt: Between(dayStart, dayEnd),
            },
          }),
          this.emailLogRepository.count({
            where: {
              status: 'failed',
              lastStatusAt: Between(dayStart, dayEnd),
            },
          }),
        ]);

      // Thêm vào mảng kết quả
      dailyStats.push({
        date: new Date(currentDate),
        sent,
        delivered,
        opened,
        clicked,
        bounced,
        failed,
      });

      // Tăng ngày lên 1
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dailyStats;
  }

  @ApiOperation({ summary: 'Get detailed template metrics' })
  @ApiResponse({ status: 200, description: 'Returns template metrics' })
  @Get('template-metrics/:name')
  async getTemplateMetrics(
    @Param('name') templateName: string,
    @Query() dateRange: DateRangeDto,
  ) {
    const { start, end } = this.getDateRange(dateRange);

    // Get detailed metrics for specific template
    const metrics = await this.emailLogRepository.query(
      `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN status = 'opened' THEN 1 ELSE 0 END) as opened,
      SUM(CASE WHEN status = 'clicked' THEN 1 ELSE 0 END) as clicked,
      SUM(CASE WHEN status = 'bounced' THEN 1 ELSE 0 END) as bounced,
      AVG(CASE WHEN openedAt IS NOT NULL THEN EXTRACT(EPOCH FROM (openedAt - sentAt))/60 ELSE NULL END) as avg_open_time_mins,
      MAX(openCount) as max_opens,
      MAX(clickCount) as max_clicks
    FROM email_logs
    WHERE template = $1 AND createdAt BETWEEN $2 AND $3
  `,
      [templateName, start, end],
    );

    // Get time series data for this template
    const dailyStats = await this.generateTemplateDailyStats(
      templateName,
      start,
      end,
    );

    return {
      metrics: metrics[0],
      dailyStats,
    };
  }

  private async generateTemplateDailyStats(
    template: string,
    start: Date,
    end: Date,
  ) {
    const dailyStats = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dayStart = new Date(currentDate);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      const [sent, delivered, opened, clicked] = await Promise.all([
        this.emailLogRepository.count({
          where: {
            template,
            sentAt: Between(dayStart, dayEnd),
          },
        }),
        this.emailLogRepository.count({
          where: {
            template,
            status: 'delivered',
            lastStatusAt: Between(dayStart, dayEnd),
          },
        }),
        this.emailLogRepository.count({
          where: {
            template,
            status: 'opened',
            openedAt: Between(dayStart, dayEnd),
          },
        }),
        this.emailLogRepository.count({
          where: {
            template,
            status: 'clicked',
            clickedAt: Between(dayStart, dayEnd),
          },
        }),
      ]);

      dailyStats.push({
        date: new Date(currentDate).toISOString().split('T')[0],
        sent,
        delivered,
        opened,
        clicked,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dailyStats;
  }
}
