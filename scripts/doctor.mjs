#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const failures = [];

function check(name, ok, detail) {
  if (ok) {
    console.log(`ok    ${name}${detail ? ` (${detail})` : ""}`);
  } else {
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    failures.push(name);
  }
}

const nodeMajor = Number(process.versions.node.split(".")[0]);
check("node >= 20", nodeMajor >= 20, `v${process.versions.node}`);

const npmUserAgent = process.env.npm_config_user_agent ?? "";
check("package manager is npm", npmUserAgent.startsWith("npm/"), npmUserAgent || "unknown");
check("not pnpm", !existsSync("pnpm-lock.yaml") && !npmUserAgent.includes("pnpm"));
check("not yarn", !existsSync("yarn.lock") && !npmUserAgent.includes("yarn"));

try {
  const turboVer = execSync("npx turbo --version", { encoding: "utf8" }).trim();
  check("turbo", true, turboVer);
} catch {
  check("turbo", false, "not found");
}

try {
  const tscVer = execSync("npx tsc --version", { encoding: "utf8" }).trim();
  check("typescript", true, tscVer);
} catch {
  check("typescript", false, "not found");
}

try {
  require.resolve("wrangler/package.json");
  check("wrangler", true);
} catch {
  check("wrangler", false, "not installed in workspaces");
}

if (failures.length > 0) {
  process.exit(1);
}
console.log("doctor passed");
