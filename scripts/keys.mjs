#!/usr/bin/env node
/**
 * Mint or rotate Brim-owned secrets. Never touches third-party credentials.
 * Usage: node scripts/with-env.mjs <dev|staging|prod> -- node scripts/keys.mjs <generate|rotate> [--yes]
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ENV_TARGETS,
  envExamplePaths,
  envPaths,
  formatEnvAssignment,
  loadEnvFile,
  mergeEnvMaps,
} from './env-file.mjs';

/** Secrets Brim generates. Third-party keys are never written here. */
export const INTERNAL_KEYS = ['BETTER_AUTH_SECRET', 'VRM_ENCRYPTION_KEY'];

export const THIRD_PARTY_KEYS = [
  'DATABASE_URL',
  'GOOGLE_MAPS_API_KEY',
  'FUEL_FINDER_CLIENT_ID',
  'FUEL_FINDER_CLIENT_SECRET',
  'DVLA_VES_API_KEY',
  'RESEND_API_KEY',
];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function generateSecret() {
  return randomBytes(32).toString('base64url');
}

export function upsertEnvKeys(text, updates) {
  const keys = Object.keys(updates);
  if (keys.length === 0) return text;
  const remaining = new Set(keys);
  const lines = text.length === 0 ? [] : text.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      out.push(line);
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq < 1) {
      out.push(line);
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (remaining.has(key)) {
      out.push(formatEnvAssignment(key, updates[key]));
      remaining.delete(key);
      continue;
    }
    out.push(line);
  }
  if (remaining.size > 0) {
    if (out.length > 0 && out[out.length - 1] !== '') out.push('');
    for (const key of INTERNAL_KEYS) {
      if (!remaining.has(key)) continue;
      out.push(formatEnvAssignment(key, updates[key]));
    }
    for (const key of remaining) {
      if (INTERNAL_KEYS.includes(key)) continue;
      out.push(formatEnvAssignment(key, updates[key]));
    }
  }
  return `${out.join('\n')}\n`;
}

export function planInternalKeys(current, mode) {
  const next = {};
  const filled = [];
  const rotated = [];
  const skipped = [];
  for (const key of INTERNAL_KEYS) {
    const existing = current[key] ?? '';
    if (mode === 'generate') {
      if (existing) {
        skipped.push(key);
        continue;
      }
      next[key] = generateSecret();
      filled.push(key);
      continue;
    }
    next[key] = generateSecret();
    rotated.push(key);
  }
  return { next, filled, skipped, rotated };
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const mode = argv[0];
  let yes = false;
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--yes' || arg === '-y') {
      yes = true;
      continue;
    }
    fail(`Unknown argument: ${arg}`);
  }
  return { mode, yes };
}

function destFiles(envName) {
  const rel = envPaths(envName);
  return [rel.dotenv, rel.wrangler];
}

function main() {
  const envName = process.env.BRIM_ENV;
  if (!envName || !ENV_TARGETS.includes(envName)) {
    fail(
      'Run via with-env.mjs so the target environment is explicit.\nUsage: node scripts/with-env.mjs <dev|staging|prod> -- node scripts/keys.mjs <generate|rotate> [--yes]',
    );
  }

  const { mode, yes } = parseArgs(process.argv.slice(2));
  if (mode !== 'generate' && mode !== 'rotate') {
    fail('Usage: node scripts/keys.mjs <generate|rotate> [--yes]');
  }

  const rel = envPaths(envName);
  const paths = destFiles(envName).map((file) => path.join(root, file));
  const existing = paths.filter((file) => existsSync(file));
  if (existing.length === 0) {
    const examples = envExamplePaths(envName);
    fail(
      `No env files found for ${envName}.\nRun npm run env:setup, or copy ${examples.dotenv} → ${rel.dotenv} and ${examples.wrangler} → ${rel.wrangler}, then re-run.`,
    );
  }

  const maps = existing.map((file) => loadEnvFile(file));
  const { merged, conflicts } = mergeEnvMaps(maps);
  if (conflicts.length > 0) {
    fail(
      `keys:${mode}: ${envName} files disagree on: ${conflicts.join(', ')}\nRe-run env:sync with --from env or --from dev.vars first.`,
    );
  }

  if (mode === 'rotate' && envName !== 'dev' && !yes) {
    fail(
      `keys:rotate: ${envName} would replace ${INTERNAL_KEYS.join(' and ')}.\nRotating BETTER_AUTH_SECRET invalidates every session. Rotating VRM_ENCRYPTION_KEY makes stored regs unreadable.\nRe-run with --yes if you mean it.`,
    );
  }

  const plan = planInternalKeys(merged, mode);
  if (Object.keys(plan.next).length === 0) {
    console.log(`keys:generate: ${envName} already has ${plan.skipped.join(', ')}`);
    return;
  }

  for (const file of existing) {
    const text = readFileSync(file, 'utf8');
    writeFileSync(file, upsertEnvKeys(text, plan.next));
  }

  const written = existing.map((file) => path.relative(root, file).replaceAll('\\', '/'));
  if (mode === 'generate') {
    console.log(
      `keys:generate: ${envName} filled ${plan.filled.join(', ')} in ${written.join(', ')}${
        plan.skipped.length > 0 ? ` (left ${plan.skipped.join(', ')})` : ''
      }`,
    );
    return;
  }
  console.log(
    `keys:rotate: ${envName} rotated ${plan.rotated.join(', ')} in ${written.join(', ')}`,
  );
}

const invokedDirectly =
  Boolean(process.argv[1]) &&
  path.normalize(path.resolve(process.argv[1])).toLowerCase() ===
    path.normalize(fileURLToPath(import.meta.url)).toLowerCase();
if (invokedDirectly) main();
