// src/types/cache-manager-redis-store.d.ts
declare module 'cache-manager-redis-store' {
  import { Store } from 'cache-manager';

  function redisStore(config?: any): Store;

  export = redisStore;
}
