#!/usr/bin/env node
/**
 * Pre-commit secret + UK VRM scan for staged diffs.
 * CI also runs gitleaks against the same .gitleaks.toml.
 */
import { execSync } from "node:child_process";

const VRM = /\b[A-Z]{2}[0-9]{2}\s?[A-Z]{3}\b/i;
const KEYISH =
  /(api[_-]?key|secret|password|BEGIN (RSA |OPENSSH )?PRIVATE KEY)\s*[:=]\s*\S+/i;

let diff = "";
try {
  diff = execSync("git diff --cached --unified=0", { encoding: "utf8" });
} catch {
  process.exit(0);
}

const hits = [];
for (const line of diff.split(/\r?\n/)) {
  if (!line.startsWith("+") || line.startsWith("+++")) continue;
  if (VRM.test(line)) hits.push("UK registration mark pattern in staged add");
  if (KEYISH.test(line)) hits.push("possible secret in staged add");
}

if (hits.length > 0) {
  console.error("secret-scan failed:");
  for (const h of [...new Set(hits)]) console.error(`  - ${h}`);
  process.exit(1);
}

try {
  execSync("gitleaks protect --staged --redact --config .gitleaks.toml", {
    stdio: "inherit",
  });
} catch (err) {
  if (err && typeof err === "object" && "status" in err && err.status === 127) {
    console.warn("gitleaks not on PATH - node secret-scan ran; CI will still run gitleaks");
    process.exit(0);
  }
  process.exit(1);
}
