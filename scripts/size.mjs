#!/usr/bin/env node
import { existsSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

const assets = walk("apps/web/dist").filter((f) => f.endsWith(".js") || f.endsWith(".css"));
if (assets.length === 0) {
  console.log("size: no apps/web/dist assets yet - run `npm run build` first");
  process.exit(0);
}

const BUDGET_KB = 150;
const BUDGET_B = BUDGET_KB * 1024;

let total = 0;
let initialJs = 0;
for (const file of assets) {
  const buf = readFileSync(file);
  const gz = gzipSync(buf).length;
  total += gz;
  const rel = file.replace(/\\/g, "/");
  console.log(`${rel}  gzip ${gz} B`);
  if (/\/assets\/index-[^/]+\.js$/.test(rel)) initialJs = gz;
}

console.log(`total JS+CSS gzip ${total} B (${(total / 1024).toFixed(1)} kB)`);
if (initialJs > 0) {
  const kb = initialJs / 1024;
  const delta = initialJs - BUDGET_B;
  const verdict = delta <= 0 ? "PASS" : "MISS";
  const deltaKb = Math.abs(delta / 1024).toFixed(1);
  console.log(
    `initial JS gzip ${initialJs} B (${kb.toFixed(1)} kB) vs ${BUDGET_KB} kB budget - ${verdict}${
      delta === 0 ? "" : ` by ${deltaKb} kB`
    }`,
  );
}
