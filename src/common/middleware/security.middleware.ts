// src/common/middleware/security.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly helmet: any;
  private readonly limiter: any;
  private readonly compression: any;
  private readonly cookieParser: any;

  constructor(private configService: ConfigService) {
    const isProduction = configService.get('NODE_ENV') === 'production';

    // Configure Helmet with strict security headers
    this.helmet = helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                'https://cdnjs.cloudflare.com',
              ],
              styleSrc: [
                "'self'",
                "'unsafe-inline'",
                'https://fonts.googleapis.com',
              ],
              fontSrc: ["'self'", 'https://fonts.gstatic.com'],
              imgSrc: ["'self'", 'data:'],
              connectSrc: ["'self'"],
              frameSrc: ["'none'"],
              objectSrc: ["'none'"],
              upgradeInsecureRequests: isProduction ? [] : null,
            },
          }
        : false,
      crossOriginEmbedderPolicy: isProduction,
      crossOriginOpenerPolicy: isProduction,
      crossOriginResourcePolicy: isProduction ? { policy: 'same-site' } : false,
      originAgentCluster: isProduction,
      dnsPrefetchControl: isProduction,
      frameguard: isProduction ? { action: 'deny' } : false,
      hsts: isProduction
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          }
        : false,
      ieNoOpen: isProduction,
      noSniff: isProduction,
      referrerPolicy: isProduction
        ? { policy: 'strict-origin-when-cross-origin' }
        : false,
      xssFilter: isProduction,
    });

    // Configure rate limiting
    this.limiter = rateLimit({
      windowMs: configService.get<number>('THROTTLE_TTL', 60) * 1000,
      max: configService.get<number>('THROTTLE_LIMIT', 60),
      standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
      legacyHeaders: false, // Disable the `X-RateLimit-*` headers
      message: 'Too many requests from this IP, please try again later',
      skip: (req: Request) => {
        // Skip rate limiting for certain routes
        const bypassPaths = this.configService
          .get<string>('THROTTLER_BYPASS_PATHS', '/health,/metrics,/api-docs')
          .split(',');

        return bypassPaths.some((path) => req.path.includes(path));
      },
    });

    // Configure compression
    this.compression = compression({
      level: 6, // Default compression level
      threshold: 1024, // Only compress responses larger than 1KB
    });

    // Configure cookie parser
    this.cookieParser = cookieParser(
      this.configService.get('COOKIE_SECRET', this.configService.get('JWT_SECRET')),
    );
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Apply cookie parser first
    this.cookieParser(req, res, (err?: Error) => {
      if (err) return next(err);

      // Then apply Helmet security headers
      this.helmet(req, res, (err?: Error) => {
        if (err) return next(err);

        // Then apply rate limiting
        this.limiter(req, res, (err?: Error) => {
          if (err) return next(err);

          // Finally apply compression
          this.compression(req, res, next);
        });
      });
    });
  }
}
// // src/common/middleware/security.middleware.ts
// import { Injectable, NestMiddleware } from '@nestjs/common';
// import { Request, Response, NextFunction } from 'express';
// import helmet from 'helmet';
// import { ConfigService } from '@nestjs/config';

// @Injectable()
// export class SecurityMiddleware implements NestMiddleware {
//   private helmet: any;

//   constructor(private configService: ConfigService) {
//     const isProduction = configService.get('NODE_ENV') === 'production';

//     this.helmet = helmet({
//       contentSecurityPolicy: isProduction
//         ? {
//             directives: {
//               defaultSrc: ["'self'"],
//               styleSrc: [
//                 "'self'",
//                 "'unsafe-inline'",
//                 'https://fonts.googleapis.com',
//               ],
//               fontSrc: ["'self'", 'https://fonts.gstatic.com'],
//               imgSrc: ["'self'", 'data:'],
//               scriptSrc: ["'self'"],
//             },
//           }
//         : false,
//       crossOriginEmbedderPolicy: isProduction,
//       crossOriginOpenerPolicy: isProduction,
//       crossOriginResourcePolicy: isProduction ? { policy: 'same-site' } : false,
//       originAgentCluster: isProduction,
//       dnsPrefetchControl: isProduction,
//       frameguard: isProduction ? { action: 'deny' } : false,
//       hsts: isProduction
//         ? {
//             maxAge: 31536000,
//             includeSubDomains: true,
//             preload: true,
//           }
//         : false,
//       ieNoOpen: isProduction,
//       noSniff: isProduction,
//       referrerPolicy: isProduction
//         ? { policy: 'strict-origin-when-cross-origin' }
//         : false,
//       xssFilter: isProduction,
//     });
//   }

//   use(req: Request, res: Response, next: NextFunction) {
//     this.helmet(req, res, next);
//   }
// }
