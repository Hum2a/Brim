#!/usr/bin/env node
/**
 * Connectivity check for Neon. No user PII, no registration marks.
 * Usage: node scripts/with-env.mjs <dev|staging|prod> -- node scripts/db-seed.mjs
 */
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("db:seed: DATABASE_URL is empty or missing");
  process.exit(1);
}

const Client = pg.Client ?? pg.default?.Client;
const client = new Client({ connectionString: url });
await client.connect();
try {
  const postgis = await client.query("SELECT PostGIS_Version() AS version");
  const version = postgis.rows[0]?.version;
  if (!version) {
    console.error("db:seed: PostGIS is not available");
    process.exit(1);
  }
  const vca = await client.query("SELECT count(*)::int AS n FROM vca_vehicles");
  console.log(`db:seed ok (PostGIS ${version}; vca_vehicles=${vca.rows[0]?.n ?? 0})`);
} finally {
  await client.end();
}
