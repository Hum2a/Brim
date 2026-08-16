#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "apps/api/src/db/migrations");
const sql = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(dir, f), "utf8"))
  .join("\n");

const created = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS (?:"?(\w+)"?)/gi)].map((m) => m[1] ?? "");
const skip = new Set(["user", "session", "account", "verification"]);
const tables = [...new Set(created.filter((t) => t && !skip.has(t)))];

if (tables.length === 0) {
  console.error("db:force-rls: no application tables found in migrations");
  process.exit(1);
}

let failed = false;
for (const table of tables) {
  const enabled = new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`, "i").test(sql);
  const policy = new RegExp(`CREATE POLICY \\w+ ON ${table}\\b`, "i").test(sql);
  if (!enabled || !policy) {
    console.error(`db:force-rls: ${table} lacks RLS enable and/or a policy`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(`db:force-rls ok (${tables.length} tables)`);
