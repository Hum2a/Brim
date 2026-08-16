#!/usr/bin/env node
/**
 * Fail (or rewrite with --fix) if any tracked-style source file contains an em dash (U+2014).
 * Usage: node scripts/no-em-dash.mjs [--fix]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EM = '\u2014';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fix = process.argv.includes('--fix');

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  '.turbo',
  'coverage',
  'playwright-report',
  'test-results',
  'dev-dist',
  '.wrangler',
]);

const TEXT_EXT = new Set([
  '.md',
  '.mdc',
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.yml',
  '.yaml',
  '.css',
  '.html',
  '.svg',
  '.example',
  '.toml',
  '.txt',
]);

const TEXT_NAMES = new Set([
  'AGENTS.md',
  'CLAUDE.md',
  '.windsurfrules',
  '.gitignore',
  '.gitleaks.toml',
  '.prettierrc',
  '.prettierignore',
]);

function isTextFile(filePath) {
  const base = path.basename(filePath);
  if (TEXT_NAMES.has(base)) return true;
  if (base.endsWith('.example')) return true;
  return TEXT_EXT.has(path.extname(filePath));
}

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (isTextFile(full)) out.push(full);
  }
}

function main() {
  const files = [];
  walk(root, files);
  const hits = [];
  for (const file of files) {
    const before = readFileSync(file, 'utf8');
    if (!before.includes(EM)) continue;
    const rel = path.relative(root, file).replaceAll('\\', '/');
    if (fix) {
      writeFileSync(file, before.replaceAll(EM, '-'));
    }
    hits.push(rel);
  }

  if (hits.length === 0) {
    console.log('no-em-dash: clean');
    return;
  }

  if (fix) {
    console.log(`no-em-dash: rewrote ${hits.length} file(s)`);
    return;
  }

  console.error(
    'no-em-dash: em dash (U+2014) is forbidden. Use a colon, comma, parentheses, or hyphen.',
  );
  for (const file of hits) console.error(`  ${file}`);
  console.error('Fix with: node scripts/no-em-dash.mjs --fix');
  process.exit(1);
}

main();
