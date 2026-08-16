#!/usr/bin/env node
/**
 * Upsert zone and toll GeoJSON into Postgres with service-role.
 * Usage: node scripts/with-env.mjs <dev|staging|prod> -- node scripts/load-zones.mjs
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function featuresIn(dir) {
  const entries = await readdir(dir).catch(() => []);
  const features = [];
  for (const name of entries) {
    if (!name.endsWith('.geojson')) continue;
    const raw = JSON.parse(await readFile(path.join(dir, name), 'utf8'));
    if (raw.type === 'FeatureCollection') features.push(...raw.features);
    else features.push(raw);
  }
  return features;
}

async function main() {
  if (!process.env.BRIM_ENV) {
    fail(
      'Run via with-env.mjs so the target environment is explicit.\nUsage: node scripts/with-env.mjs <dev|staging|prod> -- node scripts/load-zones.mjs',
    );
  }
  const url = process.env.DATABASE_URL;
  if (!url) fail('data:load-zones: DATABASE_URL is empty or missing');

  const zones = await featuresIn(path.join(root, 'data', 'zones'));
  const tolls = await featuresIn(path.join(root, 'data', 'tolls'));
  if (zones.length === 0 && tolls.length === 0) fail('data:load-zones: no GeoJSON to load');

  const Client = pg.Client ?? pg.default?.Client;
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("SELECT set_config('brim.service_role', '1', true)");
    for (const feature of zones) {
      const p = feature.properties ?? {};
      const geometry = JSON.stringify(feature.geometry);
      await client.query(
        `INSERT INTO zones (
           id, name, authority, kind, caz_class, charge_pence, is_restriction,
           applies_hours_json, geometry, source_url, operator_url, verified_on, dataset_version
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8::jsonb,
           ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($9), 4326))::geography,
           $10, $11, $12::date, $13
         )
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           authority = EXCLUDED.authority,
           kind = EXCLUDED.kind,
           caz_class = EXCLUDED.caz_class,
           charge_pence = EXCLUDED.charge_pence,
           is_restriction = EXCLUDED.is_restriction,
           applies_hours_json = EXCLUDED.applies_hours_json,
           geometry = EXCLUDED.geometry,
           source_url = EXCLUDED.source_url,
           operator_url = EXCLUDED.operator_url,
           verified_on = EXCLUDED.verified_on,
           dataset_version = EXCLUDED.dataset_version`,
        [
          p.id,
          p.name,
          p.authority ?? null,
          p.kind,
          p.caz_class ?? null,
          p.charge_pence ?? null,
          Boolean(p.is_restriction),
          JSON.stringify(p.applies_hours_json ?? {}),
          geometry,
          p.source_url ?? null,
          p.operator_url ?? null,
          p.verified_on,
          p.dataset_version ?? null,
        ],
      );
    }
    for (const feature of tolls) {
      const p = feature.properties ?? {};
      const geometry = JSON.stringify(feature.geometry);
      await client.query(
        `INSERT INTO tolls (
           id, name, operator, location, charge_pence_by_class_json,
           applies_hours_json, source_url, operator_url, verified_on
         ) VALUES (
           $1, $2, $3,
           ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)::geography,
           $5::jsonb, $6::jsonb, $7, $8, $9::date
         )
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           operator = EXCLUDED.operator,
           location = EXCLUDED.location,
           charge_pence_by_class_json = EXCLUDED.charge_pence_by_class_json,
           applies_hours_json = EXCLUDED.applies_hours_json,
           source_url = EXCLUDED.source_url,
           operator_url = EXCLUDED.operator_url,
           verified_on = EXCLUDED.verified_on`,
        [
          p.id,
          p.name,
          p.authority ?? null,
          geometry,
          JSON.stringify(p.charge_pence_by_class ?? {}),
          JSON.stringify(p.applies_hours_json ?? {}),
          p.source_url ?? null,
          p.operator_url ?? null,
          p.verified_on,
        ],
      );
    }
    console.log(`data:load-zones ok (zones=${zones.length}; tolls=${tolls.length})`);
  } finally {
    await client.end();
  }
}

await main();
