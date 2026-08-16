import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const ENV_TARGETS = ['dev', 'staging', 'prod'];

/** Paths relative to the repo root. Wrangler named envs use `.dev.vars.<wranglerEnv>`. */
export function envPaths(envName) {
  if (envName === 'dev') {
    return {
      dotenv: '.env',
      wrangler: path.join('apps', 'api', '.dev.vars'),
      web: path.join('apps', 'web', '.env'),
    };
  }
  if (envName === 'staging') {
    return {
      dotenv: '.env.staging',
      wrangler: path.join('apps', 'api', '.dev.vars.staging'),
      web: path.join('apps', 'web', '.env.staging'),
    };
  }
  return {
    dotenv: '.env.production',
    wrangler: path.join('apps', 'api', '.dev.vars.production'),
    web: path.join('apps', 'web', '.env.production'),
  };
}

/** Committed templates. Real files are gitignored. */
export function envExamplePaths(envName) {
  if (envName === 'dev') {
    return {
      dotenv: '.env.example',
      wrangler: path.join('apps', 'api', '.dev.vars.example'),
      web: path.join('apps', 'web', '.env.example'),
    };
  }
  if (envName === 'staging') {
    return {
      dotenv: '.env.staging.example',
      wrangler: path.join('apps', 'api', '.dev.vars.staging.example'),
      web: path.join('apps', 'web', '.env.staging.example'),
    };
  }
  return {
    dotenv: '.env.production.example',
    wrangler: path.join('apps', 'api', '.dev.vars.production.example'),
    web: path.join('apps', 'web', '.env.production.example'),
  };
}

export function isViteKey(key) {
  return key.startsWith('VITE_');
}

export function parseEnvText(text) {
  const out = {};
  if (!text) return out;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return null;
  return parseEnvText(readFileSync(filePath, 'utf8'));
}

export function pairsFor(envName) {
  const dest = envPaths(envName);
  const example = envExamplePaths(envName);
  return [
    { dest: dest.dotenv, example: example.dotenv },
    { dest: dest.wrangler, example: example.wrangler },
    { dest: dest.web, example: example.web },
  ];
}

export function missingExampleKeys(destMap, exampleMap) {
  return Object.keys(exampleMap).filter((key) => !Object.hasOwn(destMap, key));
}

export function formatEnvAssignment(key, value) {
  return `${key}=${quoteValue(value ?? '')}`;
}

export function appendMissingFromExample(destText, destMap, exampleMap) {
  const missing = missingExampleKeys(destMap, exampleMap);
  if (missing.length === 0) return { text: destText, added: [] };
  const base = destText.endsWith('\n') || destText.length === 0 ? destText : `${destText}\n`;
  const block = [
    '',
    '# Keys added by env:merge from the example template.',
    ...missing.map((key) => formatEnvAssignment(key, exampleMap[key])),
    '',
  ];
  return { text: `${base}${block.join('\n')}`, added: missing };
}

function quoteValue(value) {
  if (value === '') return '';
  if (/[\s#"']/.test(value)) return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  return value;
}

export function serializeEnv(map, header) {
  const keys = Object.keys(map).sort();
  const lines = [header, ''];
  for (const key of keys) {
    lines.push(`${key}=${quoteValue(map[key] ?? '')}`);
  }
  return `${lines.join('\n')}\n`;
}

export function pickKeys(map, predicate) {
  const out = {};
  for (const [key, value] of Object.entries(map)) {
    if (predicate(key)) out[key] = value;
  }
  return out;
}

/**
 * Union maps. On conflicting values, `conflicts` lists the keys.
 * `prefer` picks a winner for those keys when set.
 */
export function mergeEnvMaps(maps, prefer) {
  const merged = {};
  const conflicts = [];
  const seen = new Map();
  for (const map of maps) {
    if (!map) continue;
    for (const [key, value] of Object.entries(map)) {
      const previous = seen.get(key);
      if (previous === undefined) {
        seen.set(key, value);
        merged[key] = value;
        continue;
      }
      if (previous === value) continue;
      conflicts.push(key);
      if (prefer === 'latter') merged[key] = value;
    }
  }
  return { merged, conflicts: [...new Set(conflicts)].sort() };
}

export function loadEnvFor(root, envName) {
  const rel = envPaths(envName);
  const dotenv = loadEnvFile(path.join(root, rel.dotenv));
  const wrangler = loadEnvFile(path.join(root, rel.wrangler));
  const { merged } = mergeEnvMaps([dotenv, wrangler], 'latter');
  return merged;
}
