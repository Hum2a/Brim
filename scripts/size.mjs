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
  console.log("size: no apps/web/dist assets yet — run `npm run build` first");
  process.exit(0);
}

let total = 0;
for (const file of assets) {
  const buf = readFileSync(file);
  const gz = gzipSync(buf).length;
  total += gz;
  console.log(`${file.replace(/\\/g, "/")}  gzip ${gz} B`);
}
console.log(`total JS+CSS gzip ${total} B (${(total / 1024).toFixed(1)} kB)`);
