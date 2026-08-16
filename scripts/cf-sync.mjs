#!/usr/bin/env node
/**
 * Push Worker secrets from local env files to Cloudflare for one explicit environment.
 * Config vars in wrangler.jsonc (BRIM_FIXTURES, WEB_ORIGIN) apply on deploy, not here.
 * Usage: node scripts/with-env.mjs <dev|staging|prod> -- node scripts/cf-sync.mjs [--dry-run] [--yes]
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ENV_TARGETS,
  envExamplePaths,
  envPaths,
  isViteKey,
  loadEnvFile,
  mergeEnvMaps,
  serializeEnv,
} from './env-file.mjs';

/** Keys committed in wrangler.jsonc `vars`. Never uploaded as secrets. */
export const CONFIG_VAR_KEYS = ['BRIM_FIXTURES', 'WEB_ORIGIN'];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HEADER = '# Temporary cf:sync payload. Do not commit.';

export function wranglerEnvFlag(envName) {
  if (envName === 'dev') return '';
  if (envName === 'staging') return 'staging';
  return 'production';
}

export function wranglerWorkerName(envName) {
  if (envName === 'dev') return 'brim-api';
  if (envName === 'staging') return 'brim-api-staging';
  return 'brim-api-production';
}

export function varsFromWranglerConfig(config, envName) {
  const flag = wranglerEnvFlag(envName);
  if (!flag) return { ...(config.vars ?? {}) };
  return { ...(config.env?.[flag]?.vars ?? {}) };
}

export function planCloudflareSync(workerMap, configVars) {
  const secrets = {};
  const skippedEmpty = [];
  const skippedVite = [];
  const configVarKeys = [];
  const varDrift = [];
  const config = configVars ?? {};

  for (const [key, value] of Object.entries(workerMap ?? {})) {
    if (isViteKey(key)) {
      skippedVite.push(key);
      continue;
    }
    if (CONFIG_VAR_KEYS.includes(key)) {
      configVarKeys.push(key);
      const committed = config[key] ?? '';
      if (value !== '' && committed !== '' && value !== committed) {
        varDrift.push(key);
      }
      continue;
    }
    if (value === '') {
      skippedEmpty.push(key);
      continue;
    }
    secrets[key] = value;
  }

  return {
    secrets,
    secretKeys: Object.keys(secrets).sort(),
    skippedEmpty: skippedEmpty.sort(),
    skippedVite: skippedVite.sort(),
    configVarKeys: [...new Set(configVarKeys)].sort(),
    varDrift: varDrift.sort(),
  };
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  let dryRun = false;
  let yes = false;
  for (const arg of argv) {
    if (arg === '--dry-run' || arg === '--check') {
      dryRun = true;
      continue;
    }
    if (arg === '--yes' || arg === '-y') {
      yes = true;
      continue;
    }
    fail(`Unknown argument: ${arg}`);
  }
  return { dryRun, yes };
}

function loadWranglerConfig() {
  const rel = path.join('apps', 'api', 'wrangler.jsonc');
  const raw = readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  try {
    return JSON.parse(stripped);
  } catch {
    fail(`cf:sync: could not parse ${rel.replaceAll('\\', '/')}`);
  }
}

function describePlan(envName, plan) {
  const worker = wranglerWorkerName(envName);
  const flag = wranglerEnvFlag(envName);
  const target = flag ? `${worker} --env ${flag}` : `${worker} (top-level)`;
  const bits = [`cf:sync: ${envName} -> ${target}`];
  bits.push(
    plan.secretKeys.length > 0
      ? `secrets: ${plan.secretKeys.join(', ')}`
      : 'secrets: none (all empty or skipped)',
  );
  if (plan.configVarKeys.length > 0) {
    bits.push(`vars in wrangler.jsonc (next deploy): ${plan.configVarKeys.join(', ')}`);
  }
  if (plan.skippedEmpty.length > 0) {
    bits.push(`skipped empty: ${plan.skippedEmpty.join(', ')}`);
  }
  return bits.join('\n');
}

function runWrangler(args) {
  const wranglerJs = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [wranglerJs, ...args], {
      cwd: path.join(root, 'apps', 'api'),
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code, signal) => {
      if (signal) resolve(1);
      else resolve(code ?? 1);
    });
  });
}

async function main() {
  const envName = process.env.BRIM_ENV;
  if (!envName || !ENV_TARGETS.includes(envName)) {
    fail(
      'Run via with-env.mjs so the target environment is explicit.\nUsage: node scripts/with-env.mjs <dev|staging|prod> -- node scripts/cf-sync.mjs [--dry-run] [--yes]',
    );
  }

  const { dryRun, yes } = parseArgs(process.argv.slice(2));
  const rel = envPaths(envName);
  const wranglerPath = path.join(root, rel.wrangler);
  const dotenvPath = path.join(root, rel.dotenv);
  const wranglerMap = loadEnvFile(wranglerPath);
  const dotenvMap = loadEnvFile(dotenvPath);

  if (!wranglerMap && !dotenvMap) {
    const examples = envExamplePaths(envName);
    fail(
      `No env files found for ${envName}.\nRun npm run env:setup, or copy ${examples.dotenv} → ${rel.dotenv} and ${examples.wrangler} → ${rel.wrangler}, then re-run.`,
    );
  }

  const { merged, conflicts } = mergeEnvMaps([dotenvMap, wranglerMap]);
  if (conflicts.length > 0) {
    fail(
      `cf:sync: ${envName} files disagree on: ${conflicts.join(', ')}\nRe-run env:sync with --from env or --from dev.vars first.`,
    );
  }

  const workerMap = Object.fromEntries(Object.entries(merged).filter(([key]) => !isViteKey(key)));
  const configVars = varsFromWranglerConfig(loadWranglerConfig(), envName);
  const plan = planCloudflareSync(workerMap, configVars);

  if (plan.varDrift.length > 0) {
    fail(
      `cf:sync: ${envName} local files disagree with wrangler.jsonc vars: ${plan.varDrift.join(', ')}\nUpdate wrangler.jsonc (those apply on deploy), or fix the local files, then re-run.`,
    );
  }

  console.log(describePlan(envName, plan));

  if (dryRun) {
    console.log('cf:sync: dry-run, nothing uploaded');
    return;
  }

  if (envName !== 'dev' && !yes) {
    fail(
      `cf:sync: ${envName} would write secrets to ${wranglerWorkerName(envName)}.\nRe-run with --yes if you mean it.`,
    );
  }

  if (plan.secretKeys.length === 0) {
    console.log('cf:sync: nothing to upload');
    return;
  }

  const dir = mkdtempSync(path.join(tmpdir(), 'brim-cf-sync-'));
  const file = path.join(dir, '.dev.vars');
  try {
    writeFileSync(file, serializeEnv(plan.secrets, HEADER));
    const args = ['secret', 'bulk', file];
    const flag = wranglerEnvFlag(envName);
    if (flag) args.push('--env', flag);
    const code = await runWrangler(args);
    if (code !== 0) process.exit(code);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  console.log(
    `cf:sync: uploaded ${plan.secretKeys.length} secret(s) to ${wranglerWorkerName(envName)}`,
  );
}

const invokedDirectly =
  Boolean(process.argv[1]) &&
  path.normalize(path.resolve(process.argv[1])).toLowerCase() ===
    path.normalize(fileURLToPath(import.meta.url)).toLowerCase();
if (invokedDirectly) {
  await main();
}
