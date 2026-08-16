import { beforeEach, describe, expect, it } from 'vitest';
import app from './index.js';
import { resetMemoryDb } from './db/memory.js';

const env = { BRIM_FIXTURES: '1' };
const origin = 'http://localhost:5173';

function cookieHeader(res: Response): string {
  const many = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  if (many.length > 0) {
    return many
      .map((entry) => entry.split(';')[0] ?? '')
      .filter(Boolean)
      .join('; ');
  }
  const single = res.headers.get('set-cookie');
  return single ? (single.split(';')[0] ?? '') : '';
}

async function json(
  path: string,
  init: RequestInit = {},
): Promise<{ res: Response; body: Record<string, unknown> }> {
  const headers = new Headers(init.headers);
  if (!headers.has('Origin')) headers.set('Origin', origin);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await app.request(path, { ...init, headers }, env);
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { res, body };
}

describe('auth routes', () => {
  beforeEach(() => {
    resetMemoryDb();
  });

  it('signs up, returns a user session, then signs out', async () => {
    const signup = await json('/v1/auth/sign-up/email', {
      method: 'POST',
      body: JSON.stringify({ email: 'driver@example.com', password: 'password1', name: 'driver' }),
    });
    expect(signup.res.status).toBeLessThan(400);
    const cookie = cookieHeader(signup.res);
    expect(cookie.length).toBeGreaterThan(0);

    const session = await json('/v1/auth/session', { headers: { Cookie: cookie } });
    expect(session.body.session).toMatchObject({ kind: 'user', email: 'driver@example.com' });

    const signout = await json('/v1/auth/sign-out', {
      method: 'POST',
      headers: { Cookie: cookie },
    });
    expect(signout.res.status).toBeLessThan(400);

    const after = await json('/v1/auth/session', {
      headers: { Cookie: cookieHeader(signout.res) || cookie },
    });
    const signed = after.body.session as { kind?: string } | null;
    expect(signed?.kind === 'user').toBe(false);
  });

  it('rejects invalid credentials', async () => {
    await json('/v1/auth/sign-up/email', {
      method: 'POST',
      body: JSON.stringify({ email: 'driver@example.com', password: 'password1', name: 'driver' }),
    });
    const login = await json('/v1/auth/sign-in/email', {
      method: 'POST',
      body: JSON.stringify({ email: 'driver@example.com', password: 'wrong-password' }),
    });
    expect(login.res.status).toBe(401);
  });

  it('accepts magic-link and reset requests in fixture mode without sending mail', async () => {
    const magic = await json('/v1/auth/sign-in/magic-link', {
      method: 'POST',
      body: JSON.stringify({
        email: 'driver@example.com',
        callbackURL: 'http://localhost:5173/account',
      }),
    });
    expect(magic.res.status).toBe(200);

    await json('/v1/auth/sign-up/email', {
      method: 'POST',
      body: JSON.stringify({ email: 'reset@example.com', password: 'password1', name: 'reset' }),
    });
    const reset = await json('/v1/auth/request-password-reset', {
      method: 'POST',
      body: JSON.stringify({
        email: 'reset@example.com',
        redirectTo: 'http://localhost:5173/account',
      }),
    });
    expect(reset.res.status).toBe(200);
  });
});
