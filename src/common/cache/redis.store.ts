// src/common/cache/redis.store.ts
import { createClient } from '@redis/client';
import { Logger } from '@nestjs/common';

interface Store {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  reset(): Promise<void>;
  mget<T>(...keys: string[]): Promise<(T | undefined)[]>;
  mset(args: [string, unknown][], ttl?: number): Promise<void>;
  mdel(...keys: string[]): Promise<void>;
}

export class RedisStore implements Store {
  private readonly defaultTtl: number;
  private readonly client: ReturnType<typeof createClient>;
  private readonly logger = new Logger(RedisStore.name);
  private connected = false;
  private connecting = false;

  constructor(config: any) {
    this.defaultTtl = config.ttl || 300; // 5 minutes default

    this.client = createClient({
      url: `redis://${config.host || 'localhost'}:${config.port || 6379}`,
      password: config.password,
    });

    this.client.on('error', (err) => {
      this.logger.error(`Redis error: ${err.message}`, err.stack);
      this.connected = false;
    });

    this.client.on('connect', () => {
      this.logger.log('Connected to Redis');
      this.connected = true;
    });

    this.connect().catch((err) => {
      this.logger.error(
        `Failed to connect to Redis: ${err.message}`,
        err.stack,
      );
    });
  }

  private async connect() {
    if (this.connected || this.connecting) return;

    try {
      this.connecting = true;
      await this.client.connect();
      this.connecting = false;
    } catch (error) {
      this.connecting = false;
      throw error;
    }
  }

  private async ensureConnection() {
    if (!this.connected) {
      await this.connect();
    }
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      await this.ensureConnection();
      const value = await this.client.get(key);
      if (!value) return undefined;
      try {
        return JSON.parse(value);
      } catch {
        return value as unknown as T;
      }
    } catch (error) {
      this.logger.error(`Error getting cache key ${key}: ${error.message}`);
      return undefined;
    }
  }

  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    try {
      await this.ensureConnection();
      const expirationTime = ttl ?? this.defaultTtl;
      await this.client.set(key, JSON.stringify(data), { EX: expirationTime });
    } catch (error) {
      this.logger.error(`Error setting cache key ${key}: ${error.message}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.ensureConnection();
      await this.client.del(key);
    } catch (error) {
      this.logger.error(`Error deleting cache key ${key}: ${error.message}`);
    }
  }

  async reset(): Promise<void> {
    try {
      await this.ensureConnection();
      await this.client.flushDb();
    } catch (error) {
      this.logger.error(`Error resetting cache: ${error.message}`);
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      await this.ensureConnection();
      const ttl = await this.client.ttl(key);
      return ttl;
    } catch (error) {
      this.logger.error(`Error getting TTL for key ${key}: ${error.message}`);
      return 0;
    }
  }

  async keys(pattern = '*'): Promise<string[]> {
    try {
      await this.ensureConnection();
      return this.client.keys(pattern);
    } catch (error) {
      this.logger.error(`Error getting cache keys: ${error.message}`);
      return [];
    }
  }

  // Implementing the missing methods required by Store interface

  async mget<T>(...keys: string[]): Promise<(T | undefined)[]> {
    try {
      await this.ensureConnection();

      if (keys.length === 0) {
        return [];
      }

      const values = await this.client.mGet(keys);

      return values.map((value) => {
        if (!value) return undefined;
        try {
          return JSON.parse(value);
        } catch {
          return value as unknown as T;
        }
      });
    } catch (error) {
      this.logger.error(`Error multi-getting cache keys: ${error.message}`);
      return keys.map(() => undefined);
    }
  }

  async mset(args: [string, unknown][], ttl?: number): Promise<void> {
    try {
      await this.ensureConnection();

      if (args.length === 0) {
        return;
      }

      // Redis doesn't have a native mset with TTL, so we need to use a pipeline/transaction
      const pipeline = this.client.multi();

      const expirationTime = ttl ?? this.defaultTtl;

      for (const [key, value] of args) {
        pipeline.set(key, JSON.stringify(value), { EX: expirationTime });
      }

      await pipeline.exec();
    } catch (error) {
      this.logger.error(`Error multi-setting cache keys: ${error.message}`);
    }
  }

  async mdel(...keys: string[]): Promise<void> {
    try {
      await this.ensureConnection();

      if (keys.length === 0) {
        return;
      }

      await this.client.del(keys);
    } catch (error) {
      this.logger.error(`Error multi-deleting cache keys: ${error.message}`);
    }
  }
}
