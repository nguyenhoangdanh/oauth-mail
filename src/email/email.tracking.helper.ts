import * as Handlebars from 'handlebars';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailTrackingHelper {
  private readonly appUrl: string;

  constructor(private readonly configService: ConfigService) {
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
    // Helper để theo dõi clicks
    Handlebars.registerHelper('trackLink', (url, emailId) => {
      if (!url || !emailId) return url;

      const trackingUrl = `${this.appUrl}/api/email/tracker/${emailId}/click?url=${encodeURIComponent(url)}`;
      return new Handlebars.SafeString(trackingUrl);
    });

    // Helper để thêm tracking pixel
    Handlebars.registerHelper('trackingPixel', (emailId) => {
      if (!emailId) return '';

      const pixelUrl = `${this.appUrl}/api/email/tracker/${emailId}/open`;
      return new Handlebars.SafeString(
        `<img src="${pixelUrl}" alt="" width="1" height="1" style="display:none;">`,
      );
    });

    // Helper để tạo nút có tracking
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

    // Helper để lấy năm hiện tại
    Handlebars.registerHelper('currentYear', () => {
      return new Date().getFullYear();
    });
  }

  /**
   * Thay thế tất cả các links trong HTML để thêm tracking
   */
  processHtmlForTracking(html: string, emailId: string): string {
    if (!html || !emailId) return html;

    // Regex để tìm tất cả các thẻ <a> links
    const linkRegex =
      /<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi;

    // Thay thế tất cả các links với tracking URLs
    const trackedHtml = html.replace(linkRegex, (match, url) => {
      const trackingUrl = `${this.appUrl}/api/email/tracker/${emailId}/click?url=${encodeURIComponent(url)}`;
      return match.replace(url, trackingUrl);
    });

    // Thêm tracking pixel vào cuối email
    const pixelUrl = `${this.appUrl}/api/email/tracker/${emailId}/open`;
    const trackingPixel = `<img src="${pixelUrl}" alt="" width="1" height="1" style="display:none;">`;

    // Thêm pixel vào trước thẻ </body> cuối cùng
    if (trackedHtml.includes('</body>')) {
      return trackedHtml.replace('</body>', `${trackingPixel}</body>`);
    }

    // Nếu không có thẻ </body>, thêm vào cuối
    return trackedHtml + trackingPixel;
  }

  /**
   * Tạo link có tracking
   */
  createTrackingLink(url: string, emailId: string): string {
    if (!url || !emailId) return url;
    return `${this.appUrl}/api/email/tracker/${emailId}/click?url=${encodeURIComponent(url)}`;
  }

  /**
   * Tạo tracking pixel URL
   */
  createTrackingPixelUrl(emailId: string): string {
    if (!emailId) return '';
    return `${this.appUrl}/api/email/tracker/${emailId}/open`;
  }
}
