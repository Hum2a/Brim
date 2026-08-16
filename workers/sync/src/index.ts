import { neonConfig, Pool } from "@neondatabase/serverless";
import {
  FUEL_FINDER_SOURCE,
  WATERMARK_SELECT_SQL,
  formatFuelFinderTimestamp,
  normaliseFuelFinder,
  persistFuelFinder,
  pullFuelFinder,
  type FuelFinderPfs,
  type FuelFinderPriceRow,
} from "@brim/shared";
import type { SyncBindings } from "./env.js";

if (typeof WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = WebSocket;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ level: "info", ...payload }));
}

export default {
  async scheduled(controller: ScheduledController, env: SyncBindings) {
    await runSync(env, new Date(controller.scheduledTime).toISOString());
  },
  fetch(): Response {
    return Response.json({ ok: true, service: "brim-sync" });
  },
};

export async function runSync(env: SyncBindings, nowIso: string): Promise<void> {
  if (!env.DATABASE_URL || !env.FUEL_FINDER_CLIENT_ID || !env.FUEL_FINDER_CLIENT_SECRET) {
    log({ skipped: "missing-secrets" });
    return;
  }

  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE brim_rls");
    await client.query("SELECT set_config('brim.service_role', '1', true)");

    const found = await client.query<{ watermark: Date | string | null }>(WATERMARK_SELECT_SQL, [
      FUEL_FINDER_SOURCE,
    ]);
    const raw = found.rows[0]?.watermark;
    const watermark = raw ? formatFuelFinderTimestamp(raw) : undefined;
    const pulled = await pullFuelFinder({
      fetch,
      sleep,
      clientId: env.FUEL_FINDER_CLIENT_ID,
      clientSecret: env.FUEL_FINDER_CLIENT_SECRET,
      ...(watermark ? { watermark } : {}),
    });
    const result = normaliseFuelFinder({
      pfs: pulled.pfs as FuelFinderPfs[],
      prices: pulled.prices as FuelFinderPriceRow[],
      nowIso,
    });
    const written = await persistFuelFinder(
      (sql, params) => client.query(sql, params),
      result,
      nowIso,
    );
    await client.query("COMMIT");
    log({
      stations: written.stations,
      prices: written.prices,
      skipped: result.skipped.length,
      incremental: Boolean(watermark),
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // connection may already be dead
    }
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}
