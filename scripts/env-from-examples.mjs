#!/usr/bin/env node
/**
 * Create gitignored env / .dev.vars files from committed examples.
 *   setup  - copy examples into place when the dest file is missing (never overwrite)
 *   merge  - same, plus append example keys that the dest file does not yet have
 * Usage: node scripts/env-from-examples.mjs <setup|merge> [--env dev|staging|prod]
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ENV_TARGETS,
  appendMissingFromExample,
  loadEnvFile,
  pairsFor,
  parseEnvText,
} from './env-file.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const mode = argv[0];
  let envName = null;
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--env') {
      const next = argv[i + 1];
      if (!next || next.startsWith('-')) fail('--env requires dev, staging, or prod');
      envName = next;
      i += 1;
      continue;
    }
    if (arg.startsWith('--env=')) {
      envName = arg.slice('--env='.length);
      continue;
    }
    fail(`Unknown argument: ${arg}`);
  }
  return { mode, envName };
}

function materialize({ mode, envNames }) {
  const created = [];
  const skipped = [];
  const merged = [];

  for (const envName of envNames) {
    for (const pair of pairsFor(envName)) {
      const dest = path.join(root, pair.dest);
      const example = path.join(root, pair.example);
      if (!existsSync(example)) fail(`Missing example ${pair.example}`);

      if (!existsSync(dest)) {
        mkdirSync(path.dirname(dest), { recursive: true });
        copyFileSync(example, dest);
        created.push(pair.dest);
        continue;
      }

      if (mode === 'setup') {
        skipped.push(pair.dest);
        continue;
      }

      const destText = readFileSync(dest, 'utf8');
      const destMap = parseEnvText(destText);
      const exampleMap = loadEnvFile(example) ?? {};
      const next = appendMissingFromExample(destText, destMap, exampleMap);
      if (next.added.length === 0) {
        skipped.push(pair.dest);
        continue;
      }
      writeFileSync(dest, next.text);
      merged.push(`${pair.dest} (+${next.added.length})`);
    }
  }

  return { created, skipped, merged };
}

function main() {
  const { mode, envName } = parseArgs(process.argv.slice(2));
  if (mode !== 'setup' && mode !== 'merge') {
    fail('Usage: node scripts/env-from-examples.mjs <setup|merge> [--env dev|staging|prod]');
  }
  if (envName && !ENV_TARGETS.includes(envName)) {
    fail(`--env must be one of ${ENV_TARGETS.join(', ')}`);
  }
  const envNames = envName ? [envName] : [...ENV_TARGETS];
  const result = materialize({ mode, envNames });

  if (result.created.length > 0) console.log(`${mode}: created ${result.created.join(', ')}`);
  if (result.merged.length > 0) console.log(`${mode}: merged ${result.merged.join(', ')}`);
  if (result.skipped.length > 0)
    console.log(`${mode}: left ${result.skipped.length} existing file(s)`);
  if (result.created.length === 0 && result.merged.length === 0) {
    console.log(`${mode}: nothing to write`);
  }
}

main();
