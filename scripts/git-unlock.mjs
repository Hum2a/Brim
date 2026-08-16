#!/usr/bin/env node
/**
 * Remove stale Git lock files (index.lock, HEAD.lock, ref locks) left after a crash.
 * Does not touch package-lock.json. Usage: npm run git:unlock
 */
import { existsSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gitDir = path.join(root, ".git");

function listLockFiles(dir) {
  const found = [];
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "objects") continue;
      found.push(...listLockFiles(full));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".lock")) found.push(full);
  }
  return found;
}

if (!existsSync(gitDir)) {
  console.error("git:unlock: no .git directory");
  process.exit(1);
}

const locks = listLockFiles(gitDir);
if (locks.length === 0) {
  console.log("git:unlock: no lock files");
  process.exit(0);
}

for (const file of locks) {
  unlinkSync(file);
  console.log(`git:unlock: removed ${path.relative(root, file)}`);
}
