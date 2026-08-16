#!/usr/bin/env node
/**
 * Pull National Grid ESO carbon intensity and upsert grid_intensity.
 * Usage: node scripts/with-env.mjs <dev|staging|prod> -- node scripts/sync-carbon.mjs [--dry-run]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = path.join(root, 'data', 'carbon', 'raw');
const dryRun = process.argv.includes('--dry-run');

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function main() {
  const brimEnv = process.env.BRIM_ENV;
  if (!brimEnv) {
    fail(
      'Run via with-env.mjs so the target environment is explicit.\nUsage: node scripts/with-env.mjs <dev|staging|prod> -- node scripts/sync-carbon.mjs',
    );
  }

  let shared;
  try {
    shared = await import('@brim/shared');
  } catch {
    fail('Cannot import @brim/shared. Build it first: npm run build -w @brim/shared');
  }

  const nowIso = new Date().toISOString();
  let periods;

  if (process.env.BRIM_FIXTURES === '1') {
    periods = shared.CARBON_INTENSITY_FIXTURES;
    console.log('fixture corpus (BRIM_FIXTURES=1); not calling Carbon Intensity');
  } else {
    await mkdir(rawDir, { recursive: true });
    const pulled = await shared.pullCarbonIntensity({ fetch, nowIso });
    periods = pulled.periods;
    const stamp = nowIso.replace(/[:.]/g, '-');
    await writeFile(path.join(rawDir, `intensity-${stamp}.json`), JSON.stringify(pulled.raw));
    console.log(`pulled ${periods.length} carbon intensity periods`);
  }

  if (dryRun) {
    console.log(`dry-run: not writing ${periods.length} rows to the database`);
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    fail(
      'DATABASE_URL is empty or missing. Set it in .env (and apps/api/.dev.vars), then npm run env:sync -- --from env.',
    );
  }

  const pg = await import('pg');
  const Client = pg.Client ?? pg.default.Client;
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('SET ROLE brim_rls');
    await client.query("SELECT set_config('brim.service_role', '1', false)");
    const written = await shared.persistCarbonIntensity(
      (sql, params) => client.query(sql, params),
      periods,
      nowIso,
    );
    console.log(`upserted ${written.rows} grid_intensity rows (${brimEnv})`);
  } finally {
    await client.end();
  }
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
