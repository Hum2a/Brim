import { neonConfig, Pool } from "@neondatabase/serverless";
import {
  FUEL_FINDER_SOURCE,
  WATERMARK_SELECT_SQL,
  formatFuelFinderTimestamp,
  normaliseFuelFinder,
  persistCarbonIntensity,
  persistFuelFinder,
  pullCarbonIntensity,
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

export type SyncDeps = {
  fetch: typeof globalThis.fetch;
  sleep: (ms: number) => Promise<void>;
};

export function syncPlan(env: SyncBindings): { carbon: boolean; fuel: boolean } {
  const database = Boolean(env.DATABASE_URL);
  return {
    carbon: database,
    fuel: database && Boolean(env.FUEL_FINDER_CLIENT_ID) && Boolean(env.FUEL_FINDER_CLIENT_SECRET),
  };
}

export default {
  async scheduled(controller: ScheduledController, env: SyncBindings) {
    await runSync(env, new Date(controller.scheduledTime).toISOString());
  },
  fetch(): Response {
    return Response.json({ ok: true, service: "brim-sync" });
  },
};

type ServiceClient = {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
};

async function withServiceRole<T>(
  databaseUrl: string,
  fn: (client: ServiceClient) => Promise<T>,
): Promise<T> {
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE brim_rls");
    await client.query("SELECT set_config('brim.service_role', '1', true)");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
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

async function runCarbon(env: SyncBindings, nowIso: string, deps: SyncDeps): Promise<void> {
  if (!env.DATABASE_URL) return;
  const pulled = await pullCarbonIntensity({ fetch: deps.fetch, nowIso });
  const written = await withServiceRole(env.DATABASE_URL, (client) =>
    persistCarbonIntensity((sql, params) => client.query(sql, params), pulled.periods, nowIso),
  );
  log({ carbonRows: written.rows });
}

async function runFuel(env: SyncBindings, nowIso: string, deps: SyncDeps): Promise<void> {
  const databaseUrl = env.DATABASE_URL;
  const clientId = env.FUEL_FINDER_CLIENT_ID;
  const clientSecret = env.FUEL_FINDER_CLIENT_SECRET;
  if (!databaseUrl || !clientId || !clientSecret) return;
  await withServiceRole(databaseUrl, async (client) => {
    const found = (await client.query(WATERMARK_SELECT_SQL, [FUEL_FINDER_SOURCE])) as {
      rows: Array<{ watermark: Date | string | null }>;
    };
    const raw = found.rows[0]?.watermark;
    const watermark = raw ? formatFuelFinderTimestamp(raw) : undefined;
    const pulled = await pullFuelFinder({
      fetch: deps.fetch,
      sleep: deps.sleep,
      clientId,
      clientSecret,
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
    log({
      stations: written.stations,
      prices: written.prices,
      skipped: result.skipped.length,
      incremental: Boolean(watermark),
    });
  });
}

export async function runSync(
  env: SyncBindings,
  nowIso: string,
  deps: SyncDeps = { fetch, sleep },
): Promise<void> {
  const plan = syncPlan(env);
  if (!plan.carbon && !plan.fuel) {
    log({ skipped: "missing-database" });
    return;
  }

  if (plan.carbon) {
    try {
      await runCarbon(env, nowIso, deps);
    } catch (err) {
      log({
        carbonError: err instanceof Error ? err.message : "carbon-sync-failed",
      });
    }
  }

  if (!plan.fuel) {
    log({ skipped: "missing-fuel-finder-secrets" });
    return;
  }

  await runFuel(env, nowIso, deps);
}
