import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import { schema } from './schema.js';
import type { BrimDb } from './types.js';

if (typeof WebSocket !== 'undefined') {
  neonConfig.webSocketConstructor = WebSocket;
}

export type RlsTx = NeonDatabase<typeof schema>;

export type RlsContext = {
  ownerId?: string;
  serviceRole?: boolean;
};

export async function withRls<T>(db: BrimDb, ctx: RlsContext, fn: (tx: RlsTx) => Promise<T>): Promise<T> {
  if (!db.connectionString) {
    throw new Error('withRls requires DATABASE_URL from the request env');
  }
  if (!ctx.ownerId && !ctx.serviceRole) {
    throw new Error('withRls requires ownerId or serviceRole');
  }

  const pool = new Pool({ connectionString: db.connectionString });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE brim_rls');
    if (ctx.ownerId) {
      await client.query("SELECT set_config('brim.owner_id', $1, true)", [ctx.ownerId]);
    }
    if (ctx.serviceRole) {
      await client.query("SELECT set_config('brim.service_role', '1', true)");
    }
    const tx = drizzle(client, { schema });
    const result = await fn(tx);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // connection may already be dead
    }
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}
