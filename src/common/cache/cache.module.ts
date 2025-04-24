// src/common/cache/cache.module.ts
import { DynamicModule, Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { RedisStore } from './redis.store';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Module({})
export class AppCacheModule {
  static register(): DynamicModule {
    return {
      module: AppCacheModule,
      imports: [
        CacheModule.registerAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: async (configService: ConfigService) => {
            const logger = new Logger('CacheModule');
            const isProduction = configService.get('NODE_ENV') === 'production';
            const useRedis = configService.get('USE_REDIS') === 'true' || isProduction;
            const defaultTtl = configService.get('CACHE_TTL', 300) * 1000; // Convert to milliseconds

            if (useRedis) {
              logger.log('Configuring Redis cache store');
              
              const host = configService.get('REDIS_HOST', 'localhost');
              const port = configService.get('REDIS_PORT', 6379);
              
              return {
                isGlobal: true,
                store: RedisStore,
                host,
                port,
                password: configService.get('REDIS_PASSWORD', ''),
                ttl: defaultTtl,
                max: 1000, // Maximum number of items in cache
                options: {
                  retryStrategy: (times: number) => {
                    // Exponential backoff for reconnection
                    const delay = Math.min(times * 100, 3000);
                    logger.log(`Retrying Redis connection attempt ${times} in ${delay}ms`);
                    return delay;
                  },
                  enableReadyCheck: true,
                  maxRetriesPerRequest: 5,
                },
              };
            }

            logger.log('Configuring in-memory cache store');
            
            return {
              isGlobal: true,
              ttl: defaultTtl,
              max: 1000, // Maximum number of items in cache
            };
          },
        }),
      ],
      exports: [CacheModule],
      providers: [
        {
          provide: 'CACHE_SERVICE',
          useFactory: (cacheManager) => {
            return {
              get: async (key: string) => {
                return await cacheManager.get(key);
              },
              set: async (key: string, value: any, ttl?: number) => {
                await cacheManager.set(key, value, ttl);
              },
              del: async (key: string) => {
                await cacheManager.del(key);
              },
              reset: async () => {
                await cacheManager.reset();
              },
            };
          },
          inject: [CACHE_MANAGER],
        },
      ],
    };
  }
}


// // src/common/cache/cache.module.ts
// import { DynamicModule, Module } from '@nestjs/common';
// import { ConfigModule, ConfigService } from '@nestjs/config';
// import { CacheModule } from '@nestjs/cache-manager';
// import redisStore from 'cache-manager-redis-store';

// @Module({})
// export class AppCacheModule {
//   static register(): DynamicModule {
//     return {
//       module: AppCacheModule,
//       imports: [
//         CacheModule.registerAsync({
//           imports: [ConfigModule],
//           inject: [ConfigService],
//           useFactory: async (configService: ConfigService) => {
//             const isProduction = configService.get('NODE_ENV') === 'production';
//             const useRedis =
//               configService.get('USE_REDIS') === 'true' || isProduction;

//             if (useRedis) {
//               return {
//                 isGlobal: true,
//                 store: redisStore,
//                 host: configService.get('REDIS_HOST', 'localhost'),
//                 port: configService.get('REDIS_PORT', 6379),
//                 password: configService.get('REDIS_PASSWORD', ''),
//                 ttl: configService.get('CACHE_TTL', 300) * 1000,
//               };
//             }

//             return {
//               isGlobal: true,
//               ttl: configService.get('CACHE_TTL', 300) * 1000,
//               max: 1000,
//             };
//           },
//         }),
//       ],
//       exports: [CacheModule],
//     };
//   }
// }
