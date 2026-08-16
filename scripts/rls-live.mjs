#!/usr/bin/env node
/**
 * Live RLS checks against Neon. Requires DATABASE_URL.
 * Usage: node scripts/with-env.mjs <dev|staging|prod> -- node scripts/rls-live.mjs
 */
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("test:rls live: skipped (no DATABASE_URL)");
  process.exit(0);
}

const Client = pg.Client ?? pg.default?.Client;
if (!Client) {
  console.error("test:rls live: pg Client not available");
  process.exit(1);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function withOwner(connectionString, ownerId, fn) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE brim_rls");
    await client.query("SELECT set_config('brim.owner_id', $1, true)", [ownerId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    throw err;
  } finally {
    await client.end();
  }
}

async function withService(connectionString, fn) {
  const client = new Client({ connectionString });
  await client.connect();
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
      // ignore
    }
    throw err;
  } finally {
    await client.end();
  }
}

async function main() {
  const ownerA = `rls-a-${crypto.randomUUID()}`;
  const ownerB = `rls-b-${crypto.randomUUID()}`;
  const vehicleId = crypto.randomUUID();
  const tariffId = crypto.randomUUID();
  const journeyId = crypto.randomUUID();
  const fillId = crypto.randomUUID();
  const calId = crypto.randomUUID();

  try {
    await withOwner(url, ownerA, async (client) => {
      await client.query(
        `INSERT INTO vehicles (id, owner_id, kind, propulsion) VALUES ($1, $2, 'car', 'petrol')`,
        [vehicleId, ownerA],
      );
      await client.query(
        `INSERT INTO tariffs (id, vehicle_id, kind, pence_per_kwh, is_default) VALUES ($1, $2, 'home', 7.5, true)`,
        [tariffId, vehicleId],
      );
      await client.query(
        `INSERT INTO journeys (id, owner_id, origin_label, dest_label, distance_meters, duration_seconds, estimate_json, charges_json)
         VALUES ($1, $2, 'A', 'B', 1000, 60, '{}'::jsonb, '[]'::jsonb)`,
        [journeyId, ownerA],
      );
      await client.query(
        `INSERT INTO fill_ups (id, vehicle_id, odometer_miles, quantity, unit, price_pence, filled_to_brim, occurred_at)
         VALUES ($1, $2, 1000, 40, 'litres', 5600, true, now())`,
        [fillId, vehicleId],
      );
      await client.query(
        `INSERT INTO calibrations (id, vehicle_id, calculated_value, unit, sample_count)
         VALUES ($1, $2, 38.2, 'mpg', 3)`,
        [calId, vehicleId],
      );
    });

    const leaked = await withOwner(url, ownerB, async (client) => {
      const vehicles = await client.query("SELECT id FROM vehicles WHERE id = $1", [vehicleId]);
      const tariffs = await client.query("SELECT id FROM tariffs WHERE id = $1", [tariffId]);
      const journeys = await client.query("SELECT id FROM journeys WHERE id = $1", [journeyId]);
      const fills = await client.query("SELECT id FROM fill_ups WHERE id = $1", [fillId]);
      const cals = await client.query("SELECT id FROM calibrations WHERE id = $1", [calId]);
      const upd = await client.query("UPDATE vehicles SET nickname = 'nope' WHERE id = $1", [vehicleId]);
      const del = await client.query("DELETE FROM vehicles WHERE id = $1", [vehicleId]);
      return {
        vehicles: vehicles.rowCount,
        tariffs: tariffs.rowCount,
        journeys: journeys.rowCount,
        fills: fills.rowCount,
        cals: cals.rowCount,
        updated: upd.rowCount,
        deleted: del.rowCount,
      };
    });

    const counts = Object.values(leaked);
    if (counts.some((n) => n !== 0)) {
      fail(`test:rls live: owner-b saw or mutated owner-a rows: ${JSON.stringify(leaked)}`);
    }

    const visible = await withOwner(url, ownerA, async (client) => {
      const vehicles = await client.query("SELECT id FROM vehicles WHERE id = $1", [vehicleId]);
      return vehicles.rowCount;
    });
    if (visible !== 1) fail("test:rls live: owner-a cannot read their own vehicle");

    console.log("test:rls live: ok");
  } finally {
    await withService(url, async (client) => {
      await client.query("DELETE FROM vehicles WHERE id = $1", [vehicleId]);
      await client.query("DELETE FROM journeys WHERE id = $1", [journeyId]);
    });
  }
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
