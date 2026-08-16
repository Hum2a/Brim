import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { ApiBindings } from '../env.js';
import type { getMemoryDb } from './memory.js';
import type { schema } from './schema.js';

export type BrimDb = {
  env: ApiBindings;
  memory: ReturnType<typeof getMemoryDb>;
  connectionString?: string;
  drizzle?: NeonHttpDatabase<typeof schema>;
};
