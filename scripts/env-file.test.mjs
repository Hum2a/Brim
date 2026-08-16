import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ENV_TARGETS,
  appendMissingFromExample,
  envExamplePaths,
  envPaths,
  isViteKey,
  mergeEnvMaps,
  missingExampleKeys,
  pairsFor,
  parseEnvText,
  pickKeys,
  serializeEnv,
} from './env-file.mjs';

describe('parseEnvText', () => {
  it('skips comments and unwraps quotes', () => {
    const map = parseEnvText(`# hi\nDATABASE_URL="postgres://x"\nEMPTY=\n`);
    assert.equal(map.DATABASE_URL, 'postgres://x');
    assert.equal(map.EMPTY, '');
    assert.equal(map['# hi'], undefined);
  });
});

describe('mergeEnvMaps', () => {
  it('unions matching values and reports conflicts', () => {
    const { merged, conflicts } = mergeEnvMaps([
      { DATABASE_URL: 'a', SHARED: '1' },
      { GOOGLE_MAPS_API_KEY: 'k', SHARED: '2' },
    ]);
    assert.equal(merged.DATABASE_URL, 'a');
    assert.equal(merged.GOOGLE_MAPS_API_KEY, 'k');
    assert.deepEqual(conflicts, ['SHARED']);
  });

  it('lets the latter map win when prefer=latter', () => {
    const { merged } = mergeEnvMaps([{ A: '1' }, { A: '2' }], 'latter');
    assert.equal(merged.A, '2');
  });

  it('does not let an empty value clobber a filled one', () => {
    const { merged, conflicts } = mergeEnvMaps(
      [{ DATABASE_URL: 'postgres://filled' }, { DATABASE_URL: '' }],
      'latter',
    );
    assert.equal(merged.DATABASE_URL, 'postgres://filled');
    assert.deepEqual(conflicts, []);
  });

  it('fills an empty key from a later map without treating it as a conflict', () => {
    const { merged, conflicts } = mergeEnvMaps(
      [{ DATABASE_URL: '' }, { DATABASE_URL: 'postgres://filled' }],
      'latter',
    );
    assert.equal(merged.DATABASE_URL, 'postgres://filled');
    assert.deepEqual(conflicts, []);
  });
});

describe('envPaths', () => {
  it('keeps staging and production files distinct from local', () => {
    const posix = (p) => p.replaceAll('\\', '/');
    assert.equal(posix(envPaths('dev').wrangler), 'apps/api/.dev.vars');
    assert.equal(envPaths('staging').dotenv, '.env.staging');
    assert.equal(posix(envPaths('staging').wrangler), 'apps/api/.dev.vars.staging');
    assert.equal(posix(envPaths('prod').wrangler), 'apps/api/.dev.vars.production');
    assert.equal(posix(envPaths('prod').web), 'apps/web/.env.production');
    assert.notEqual(envPaths('staging').dotenv, envPaths('prod').dotenv);
    assert.notEqual(posix(envPaths('staging').wrangler), posix(envPaths('prod').wrangler));
  });

  it('points each environment at its own example templates', () => {
    const posix = (p) => p.replaceAll('\\', '/');
    assert.equal(envExamplePaths('dev').dotenv, '.env.example');
    assert.equal(envExamplePaths('staging').dotenv, '.env.staging.example');
    assert.equal(posix(envExamplePaths('prod').wrangler), 'apps/api/.dev.vars.production.example');
  });
});

describe('serializeEnv', () => {
  it('sorts keys and quotes values with spaces', () => {
    const text = serializeEnv({ Z: '1', A: 'hello world' }, '# header');
    assert.match(text, /^# header\n\nA="hello world"\nZ=1\n$/);
  });
});

describe('pairsFor', () => {
  it('lists nine distinct dest files across environments', () => {
    const dests = ENV_TARGETS.flatMap((name) =>
      pairsFor(name).map((p) => p.dest.replaceAll('\\', '/')),
    );
    assert.equal(new Set(dests).size, 9);
    assert.equal(dests.length, 9);
  });
});

describe('appendMissingFromExample', () => {
  it('keeps existing values and appends only missing keys', () => {
    const dest = '# keep me\nDATABASE_URL=secret\n';
    const destMap = parseEnvText(dest);
    const example = { DATABASE_URL: '', RESEND_API_KEY: '', BRIM_FIXTURES: '0' };
    assert.deepEqual(missingExampleKeys(destMap, example), ['RESEND_API_KEY', 'BRIM_FIXTURES']);
    const next = appendMissingFromExample(dest, destMap, example);
    assert.match(next.text, /^# keep me\nDATABASE_URL=secret\n/);
    assert.match(next.text, /RESEND_API_KEY=/);
    assert.match(next.text, /BRIM_FIXTURES=0/);
    assert.equal(next.added.length, 2);
    assert.doesNotMatch(next.text, /^DATABASE_URL=$/m);
  });

  it('treats empty dest values as present', () => {
    const dest = 'RESEND_API_KEY=\n';
    const destMap = parseEnvText(dest);
    const next = appendMissingFromExample(dest, destMap, { RESEND_API_KEY: 'from-example' });
    assert.deepEqual(next.added, []);
    assert.equal(next.text, dest);
  });
});

describe('pickKeys', () => {
  it('splits VITE keys off the worker file', () => {
    const all = { DATABASE_URL: 'x', VITE_API_BASE: 'http://localhost:8787' };
    assert.deepEqual(
      pickKeys(all, (k) => !isViteKey(k)),
      { DATABASE_URL: 'x' },
    );
    assert.deepEqual(pickKeys(all, isViteKey), { VITE_API_BASE: 'http://localhost:8787' });
  });
});
