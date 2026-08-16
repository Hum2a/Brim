import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function run(args) {
  return spawnSync(process.execPath, [join(root, 'scripts', 'verify-zones.mjs'), ...args], {
    encoding: 'utf8',
  });
}

describe('verify-zones', () => {
  it('passes when verified_on is within 180 days', () => {
    const result = run(['--today=2026-08-16']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /data:verify-zones ok/);
  });

  it('fails when verified_on is older than 180 days', () => {
    const result = run(['--today=2027-08-16']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /data:verify-zones failed/);
  });
});
