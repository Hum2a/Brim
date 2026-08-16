import type { CacheStore } from '@brim/routing';
import { neonRouteCacheGet, neonRouteCachePut } from './neon-repo.js';
import type { BrimDb } from './types.js';

export class NeonRouteCache implements CacheStore {
  constructor(private readonly db: BrimDb) {}

  get(key: string): Promise<string | null> {
    return neonRouteCacheGet(this.db, key);
  }

  put(key: string, value: string, ttlSeconds: number): Promise<void> {
    return neonRouteCachePut(this.db, key, value, ttlSeconds);
  }
}
