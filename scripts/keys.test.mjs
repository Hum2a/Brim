import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  INTERNAL_KEYS,
  THIRD_PARTY_KEYS,
  generateSecret,
  planInternalKeys,
  upsertEnvKeys,
} from './keys.mjs';

describe('INTERNAL_KEYS', () => {
  it('only lists Brim-owned secrets', () => {
    assert.deepEqual(INTERNAL_KEYS, ['BETTER_AUTH_SECRET', 'VRM_ENCRYPTION_KEY']);
    for (const key of THIRD_PARTY_KEYS) {
      assert.equal(INTERNAL_KEYS.includes(key), false);
    }
  });
});

describe('generateSecret', () => {
  it('returns unique 32-byte base64url values', () => {
    const a = generateSecret();
    const b = generateSecret();
    assert.match(a, /^[A-Za-z0-9_-]+$/);
    assert.equal(Buffer.from(a, 'base64url').length, 32);
    assert.notEqual(a, b);
  });
});

describe('planInternalKeys', () => {
  it('generate fills only empty keys', () => {
    const plan = planInternalKeys(
      { BETTER_AUTH_SECRET: 'keep-me', VRM_ENCRYPTION_KEY: '' },
      'generate',
    );
    assert.deepEqual(plan.skipped, ['BETTER_AUTH_SECRET']);
    assert.deepEqual(plan.filled, ['VRM_ENCRYPTION_KEY']);
    assert.equal(plan.next.BETTER_AUTH_SECRET, undefined);
    assert.equal(Buffer.from(plan.next.VRM_ENCRYPTION_KEY, 'base64url').length, 32);
  });

  it('rotate replaces every internal key', () => {
    const plan = planInternalKeys(
      { BETTER_AUTH_SECRET: 'old-auth', VRM_ENCRYPTION_KEY: 'old-vrm' },
      'rotate',
    );
    assert.deepEqual(plan.rotated, INTERNAL_KEYS);
    assert.notEqual(plan.next.BETTER_AUTH_SECRET, 'old-auth');
    assert.notEqual(plan.next.VRM_ENCRYPTION_KEY, 'old-vrm');
  });
});

describe('upsertEnvKeys', () => {
  it('replaces empty assignments and keeps comments and third-party values', () => {
    const src =
      '# keep me\nDATABASE_URL=postgres://x\nBETTER_AUTH_SECRET=\nGOOGLE_MAPS_API_KEY=third\n';
    const next = upsertEnvKeys(src, { BETTER_AUTH_SECRET: 'minted-secret' });
    assert.match(next, /^# keep me\n/);
    assert.match(next, /^DATABASE_URL=postgres:\/\/x$/m);
    assert.match(next, /^GOOGLE_MAPS_API_KEY=third$/m);
    assert.match(next, /^BETTER_AUTH_SECRET=minted-secret$/m);
  });

  it('appends a missing internal key without dropping the rest', () => {
    const src = 'RESEND_API_KEY=third\n';
    const next = upsertEnvKeys(src, { VRM_ENCRYPTION_KEY: 'minted-vrm' });
    assert.match(next, /^RESEND_API_KEY=third$/m);
    assert.match(next, /^VRM_ENCRYPTION_KEY=minted-vrm$/m);
  });
});
