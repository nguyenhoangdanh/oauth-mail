import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { EmailLog } from './entities/email-log.entity';
import { EmailStats } from './entities/email-stats.entity';

@Injectable()
export class EmailStatsCronService {
  private readonly logger = new Logger(EmailStatsCronService.name);

  constructor(
    @InjectRepository(EmailLog)
    private readonly emailLogRepository: Repository<EmailLog>,
    @InjectRepository(EmailStats)
    private readonly emailStatsRepository: Repository<EmailStats>,
  ) {}

  // Chạy vào 00:05 mỗi ngày
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async updateDailyStats() {
    this.logger.log('Running daily email stats update');

    // Lấy ngày hôm qua
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Kiểm tra xem đã có thống kê cho ngày hôm qua chưa
    const existingStats = await this.emailStatsRepository.findOne({
      where: { date: yesterday },
    });

    if (existingStats) {
      this.logger.log('Stats for yesterday already exist, skipping update');
      return;
    }

    // Lấy số liệu cho ngày hôm qua
    const [sent, delivered, opened, clicked, bounced, failed] =
      await Promise.all([
        this.emailLogRepository.count({
          where: {
            sentAt: Between(yesterday, today),
          },
        }),
        this.emailLogRepository.count({
          where: {
            status: 'delivered',
            lastStatusAt: Between(yesterday, today),
          },
        }),
        this.emailLogRepository.count({
          where: {
            status: 'opened',
            openedAt: Between(yesterday, today),
          },
        }),
        this.emailLogRepository.count({
          where: {
            status: 'clicked',
            clickedAt: Between(yesterday, today),
          },
        }),
        this.emailLogRepository.count({
          where: {
            status: 'bounced',
            lastStatusAt: Between(yesterday, today),
          },
        }),
        this.emailLogRepository.count({
          where: {
            status: 'failed',
            lastStatusAt: Between(yesterday, today),
          },
        }),
      ]);

    // Tạo bản ghi thống kê mới
    const stats = new EmailStats();
    stats.date = yesterday;
    stats.sent = sent;
    stats.delivered = delivered;
    stats.opened = opened;
    stats.clicked = clicked;
    stats.bounced = bounced;
    stats.failed = failed;

    await this.emailStatsRepository.save(stats);
    this.logger.log(
      `Updated stats for ${yesterday.toISOString().split('T')[0]}`,
    );
  }

  // Cập nhật tổng hợp thống kê hàng tuần vào Chủ nhật
  @Cron(CronExpression.EVERY_WEEK)
  async updateWeeklyStats() {
    this.logger.log('Running weekly email stats summary');

    // Logic tổng hợp thống kê theo tuần
    // Có thể lưu vào bảng riêng hoặc gửi báo cáo qua email
  }
}
