// src/common/middleware/security.middleware.ts (enhanced version)
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import rateLimit from 'express-rate-limit';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly helmet: any;
  private readonly limiter: any;

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
              connectSrc: ["'self'", 'https://api.emailjs.com'],
              frameSrc: ["'none'"],
              objectSrc: ["'none'"],
              upgradeInsecureRequests: [],
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
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req: Request) => {
        // Skip rate limiting for certain routes or for admin users
        const bypassRateLimitPaths = this.configService
          .get<string>('RATE_LIMIT_BYPASS_PATHS', '/health,/metrics')
          .split(',');

        return bypassRateLimitPaths.some((path) => req.path.includes(path));
      },
    });
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Apply Helmet security headers
    this.helmet(req, res, (err?: Error) => {
      if (err) return next(err);

      // Apply rate limiting
      this.limiter(req, res, next);
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
