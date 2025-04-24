// src/common/cache/cache.module.ts
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import redisStore from 'cache-manager-redis-store';

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
            const isProduction = configService.get('NODE_ENV') === 'production';
            const useRedis =
              configService.get('USE_REDIS') === 'true' || isProduction;

            if (useRedis) {
              return {
                isGlobal: true,
                store: redisStore,
                host: configService.get('REDIS_HOST', 'localhost'),
                port: configService.get('REDIS_PORT', 6379),
                password: configService.get('REDIS_PASSWORD', ''),
                ttl: configService.get('CACHE_TTL', 300) * 1000,
              };
            }

            return {
              isGlobal: true,
              ttl: configService.get('CACHE_TTL', 300) * 1000,
              max: 1000,
            };
          },
        }),
      ],
      exports: [CacheModule],
    };
  }
}
