// src/email/email.tracking.helper.ts
import * as Handlebars from 'handlebars';
import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailLog } from './entities/email-log.entity';

@Injectable()
export class EmailTrackingHelper {
  private readonly logger = new Logger(EmailTrackingHelper.name);
  private readonly appUrl: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(EmailLog)
    private readonly emailLogRepository: Repository<EmailLog>,
  ) {
    this.appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );
    this.registerHandlebarsHelpers();
  }

  /**
   * Register custom Handlebars helpers for email tracking
   */
  private registerHandlebarsHelpers(): void {
    // Helper for tracking links
    Handlebars.registerHelper('trackLink', (url, emailId) => {
      if (!url || !emailId) return url;

      const trackingUrl = `${this.appUrl}/api/email/tracker/${emailId}/click?url=${encodeURIComponent(url)}`;
      return new Handlebars.SafeString(trackingUrl);
    });

    // Helper for adding tracking pixel
    Handlebars.registerHelper('trackingPixel', (emailId) => {
      if (!emailId) return '';

      const pixelUrl = `${this.appUrl}/api/email/tracker/${emailId}/open`;
      return new Handlebars.SafeString(
        `<img src="${pixelUrl}" alt="" width="1" height="1" style="display:none;">`,
      );
    });

    // Helper for creating tracked buttons
    Handlebars.registerHelper(
      'trackButton',
      (url, text, emailId, className = '') => {
        if (!url || !emailId) return '';

        const trackingUrl = `${this.appUrl}/api/email/tracker/${emailId}/click?url=${encodeURIComponent(url)}`;

        return new Handlebars.SafeString(`
        <a href="${trackingUrl}" class="${className}" style="display: inline-block; background-color: #4F46E5; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; margin: 20px 0; text-align: center;">${text}</a>
      `);
      },
    );

    // Helper for getting current year
    Handlebars.registerHelper('currentYear', () => {
      return new Date().getFullYear();
    });

    // Helper for conditional statements
    Handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
      switch (operator) {
        case '==':
          return v1 == v2 ? options.fn(this) : options.inverse(this);
        case '===':
          return v1 === v2 ? options.fn(this) : options.inverse(this);
        case '!=':
          return v1 != v2 ? options.fn(this) : options.inverse(this);
        case '!==':
          return v1 !== v2 ? options.fn(this) : options.inverse(this);
        case '<':
          return v1 < v2 ? options.fn(this) : options.inverse(this);
        case '<=':
          return v1 <= v2 ? options.fn(this) : options.inverse(this);
        case '>':
          return v1 > v2 ? options.fn(this) : options.inverse(this);
        case '>=':
          return v1 >= v2 ? options.fn(this) : options.inverse(this);
        case '&&':
          return v1 && v2 ? options.fn(this) : options.inverse(this);
        case '||':
          return v1 || v2 ? options.fn(this) : options.inverse(this);
        default:
          return options.inverse(this);
      }
    });

    // Helper for concatenation
    Handlebars.registerHelper('concat', function () {
      const args = Array.prototype.slice.call(arguments);
      // Remove the Handlebars options object
      args.pop();
      return args.join('');
    });

    // Helper for date formatting
    Handlebars.registerHelper('formatDate', function (date, format) {
      if (!date) return '';

      const d = new Date(date);

      // Simple format implementation
      switch (format) {
        case 'short':
          return d.toLocaleDateString();
        case 'long':
          return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
        case 'time':
          return d.toLocaleTimeString();
        case 'iso':
          return d.toISOString();
        default:
          return d.toString();
      }
    });
  }

  /**
   * Process HTML content to add tracking to all links and add tracking pixel
   */
  processHtmlForTracking(html: string, emailId: string): string {
    if (!html || !emailId) return html;

    // Regex to find all <a> tags links
    const linkRegex =
      /<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi;

    // Replace all links with tracking URLs
    let trackedHtml = html.replace(linkRegex, (match, url) => {
      // Skip if URL is already a tracking URL
      if (url.includes('/api/email/tracker/')) {
        return match;
      }

      const trackingUrl = `${this.appUrl}/api/email/tracker/${emailId}/click?url=${encodeURIComponent(url)}`;
      return match.replace(url, trackingUrl);
    });

    // Add tracking pixel before </body> if not already present
    const pixelUrl = `${this.appUrl}/api/email/tracker/${emailId}/open`;
    const trackingPixel = `<img src="${pixelUrl}" alt="" width="1" height="1" style="display:none;">`;

    // Check if pixel is already in the HTML
    if (!trackedHtml.includes(pixelUrl)) {
      // Add pixel before </body> if it exists
      if (trackedHtml.includes('</body>')) {
        trackedHtml = trackedHtml.replace('</body>', `${trackingPixel}</body>`);
      } else {
        // Otherwise add to the end
        trackedHtml += trackingPixel;
      }
    }

    return trackedHtml;
  }

  /**
   * Create a tracking link
   */
  createTrackingLink(url: string, emailId: string): string {
    if (!url || !emailId) return url;
    return `${this.appUrl}/api/email/tracker/${emailId}/click?url=${encodeURIComponent(url)}`;
  }

  /**
   * Create a tracking pixel URL
   */
  createTrackingPixelUrl(emailId: string): string {
    if (!emailId) return '';
    return `${this.appUrl}/api/email/tracker/${emailId}/open`;
  }

  /**
   * Track email open event
   */
  async trackOpen(
    emailId: string,
    metadata: Record<string, any> = {},
  ): Promise<void> {
    try {
      // Update email log
      const emailLog = await this.emailLogRepository.findOne({
        where: { emailId },
      });

      if (emailLog) {
        // Update open count and status
        emailLog.openCount = (emailLog.openCount || 0) + 1;

        // Only update opened status and time if this is the first open
        if (!emailLog.openedAt) {
          emailLog.status = 'opened';
          emailLog.openedAt = new Date();
          emailLog.lastStatusAt = new Date();
        }

        // Update metadata if provided
        if (metadata.ipAddress) {
          emailLog.ipAddress = metadata.ipAddress;
        }

        if (metadata.userAgent) {
          emailLog.userAgent = metadata.userAgent;
        }

        await this.emailLogRepository.save(emailLog);

        this.logger.log(`Tracked open for email ${emailId}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to track email open: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Track email click event
   */
  async trackClick(
    emailId: string,
    url: string,
    metadata: Record<string, any> = {},
  ): Promise<void> {
    try {
      // Update email log
      const emailLog = await this.emailLogRepository.findOne({
        where: { emailId },
      });

      if (emailLog) {
        // Update click count and status
        emailLog.clickCount = (emailLog.clickCount || 0) + 1;

        // Only update clicked status and time if this is the first click
        if (!emailLog.clickedAt) {
          emailLog.status = 'clicked';
          emailLog.clickedAt = new Date();
          emailLog.lastStatusAt = new Date();
        }

        // Always update the last clicked URL
        emailLog.clickUrl = url;

        // Update metadata if provided
        if (metadata.ipAddress) {
          emailLog.ipAddress = metadata.ipAddress;
        }

        if (metadata.userAgent) {
          emailLog.userAgent = metadata.userAgent;
        }

        if (metadata.device) {
          emailLog.device = metadata.device;
        }

        if (metadata.location) {
          emailLog.location = metadata.location;
        }

        await this.emailLogRepository.save(emailLog);

        this.logger.log(`Tracked click for email ${emailId} on URL ${url}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to track email click: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Extract device info from user agent
   */
  extractDeviceInfo(userAgent: string): string {
    if (!userAgent) return 'Unknown';

    // Simple device detection logic
    if (/iPhone|iPad|iPod/i.test(userAgent)) {
      return 'iOS Device';
    } else if (/Android/i.test(userAgent)) {
      return 'Android Device';
    } else if (/Windows Phone/i.test(userAgent)) {
      return 'Windows Phone';
    } else if (/Windows/i.test(userAgent)) {
      return 'Windows Computer';
    } else if (/Macintosh|Mac OS X/i.test(userAgent)) {
      return 'Mac Computer';
    } else if (/Linux/i.test(userAgent)) {
      return 'Linux Computer';
    } else {
      return 'Unknown Device';
    }
  }
}

// import * as Handlebars from 'handlebars';
// import { ConfigService } from '@nestjs/config';
// import { Injectable } from '@nestjs/common';

// @Injectable()
// export class EmailTrackingHelper {
//   private readonly appUrl: string;

//   constructor(private readonly configService: ConfigService) {
//     this.appUrl = this.configService.get<string>(
//       'APP_URL',
//       'http://localhost:3000',
//     );
//     this.registerHandlebarsHelpers();
//   }

//   /**
//    * Register custom Handlebars helpers for email tracking
//    */
//   private registerHandlebarsHelpers(): void {
//     // Helper để theo dõi clicks
//     Handlebars.registerHelper('trackLink', (url, emailId) => {
//       if (!url || !emailId) return url;

//       const trackingUrl = `${this.appUrl}/api/email/tracker/${emailId}/click?url=${encodeURIComponent(url)}`;
//       return new Handlebars.SafeString(trackingUrl);
//     });

//     // Helper để thêm tracking pixel
//     Handlebars.registerHelper('trackingPixel', (emailId) => {
//       if (!emailId) return '';

//       const pixelUrl = `${this.appUrl}/api/email/tracker/${emailId}/open`;
//       return new Handlebars.SafeString(
//         `<img src="${pixelUrl}" alt="" width="1" height="1" style="display:none;">`,
//       );
//     });

//     // Helper để tạo nút có tracking
//     Handlebars.registerHelper(
//       'trackButton',
//       (url, text, emailId, className = '') => {
//         if (!url || !emailId) return '';

//         const trackingUrl = `${this.appUrl}/api/email/tracker/${emailId}/click?url=${encodeURIComponent(url)}`;

//         return new Handlebars.SafeString(`
//         <a href="${trackingUrl}" class="${className}" style="display: inline-block; background-color: #4F46E5; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; margin: 20px 0; text-align: center;">${text}</a>
//       `);
//       },
//     );

//     // Helper để lấy năm hiện tại
//     Handlebars.registerHelper('currentYear', () => {
//       return new Date().getFullYear();
//     });
//   }

//   /**
//    * Thay thế tất cả các links trong HTML để thêm tracking
//    */
//   processHtmlForTracking(html: string, emailId: string): string {
//     if (!html || !emailId) return html;

//     // Regex để tìm tất cả các thẻ <a> links
//     const linkRegex =
//       /<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi;

//     // Thay thế tất cả các links với tracking URLs
//     const trackedHtml = html.replace(linkRegex, (match, url) => {
//       const trackingUrl = `${this.appUrl}/api/email/tracker/${emailId}/click?url=${encodeURIComponent(url)}`;
//       return match.replace(url, trackingUrl);
//     });

//     // Thêm tracking pixel vào cuối email
//     const pixelUrl = `${this.appUrl}/api/email/tracker/${emailId}/open`;
//     const trackingPixel = `<img src="${pixelUrl}" alt="" width="1" height="1" style="display:none;">`;

//     // Thêm pixel vào trước thẻ </body> cuối cùng
//     if (trackedHtml.includes('</body>')) {
//       return trackedHtml.replace('</body>', `${trackingPixel}</body>`);
//     }

//     // Nếu không có thẻ </body>, thêm vào cuối
//     return trackedHtml + trackingPixel;
//   }

//   /**
//    * Tạo link có tracking
//    */
//   createTrackingLink(url: string, emailId: string): string {
//     if (!url || !emailId) return url;
//     return `${this.appUrl}/api/email/tracker/${emailId}/click?url=${encodeURIComponent(url)}`;
//   }

//   /**
//    * Tạo tracking pixel URL
//    */
//   createTrackingPixelUrl(emailId: string): string {
//     if (!emailId) return '';
//     return `${this.appUrl}/api/email/tracker/${emailId}/open`;
//   }
// }
