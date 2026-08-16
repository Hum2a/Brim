import { describe, expect, it } from 'vitest';
import { createAuth, createDb } from './client.js';

describe('per-request factories', () => {
  it('createDb refuses a live env without DATABASE_URL', () => {
    expect(() => createDb({ BRIM_FIXTURES: '0' })).toThrow(/DATABASE_URL/);
  });

  it('createDb allows fixture mode without a database', () => {
    expect(createDb({ BRIM_FIXTURES: '1' }).memory).toBeDefined();
  });

  it('createAuth refuses missing secret outside fixtures', () => {
    expect(() => createAuth({})).toThrow(/BETTER_AUTH_SECRET/);
  });

  it('createAuth returns a Better Auth instance in fixture mode', () => {
    const auth = createAuth({ BRIM_FIXTURES: '1' });
    expect(typeof auth.handler).toBe('function');
    expect(auth.api).toBeDefined();
  });

  it('does not construct an auth client at module scope', () => {
    const a = createAuth({ BRIM_FIXTURES: '1' });
    const b = createAuth({ BRIM_FIXTURES: '1' });
    expect(a).not.toBe(b);
    expect(typeof a.handler).toBe('function');
  });
});
