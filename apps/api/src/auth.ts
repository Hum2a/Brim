import { isFixtureMode } from '@brim/shared';
import type { ApiBindings } from './env.js';
import { getMemoryDb } from './db/memory.js';

export type Session = {
  ownerId: string;
  kind: 'anon' | 'user';
  email?: string;
};

const COOKIE = 'brim_anon';

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return b64(sig);
}

export function authSecret(env: ApiBindings): string {
  const secret =
    env.BETTER_AUTH_SECRET ??
    (isFixtureMode(env.BRIM_FIXTURES) ? 'fixture-dev-secret-not-for-production' : undefined);
  if (!secret) {
    throw new Error('createAuth requires BETTER_AUTH_SECRET from the request env');
  }
  return secret;
}

export function cookieHeader(token: string, requestUrl: string): string {
  const secure = requestUrl.startsWith('https:');
  const sameSite = secure ? 'None' : 'Lax';
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=31536000${secure ? '; Secure' : ''}`;
}

export function clearCookieHeader(requestUrl: string): string {
  const secure = requestUrl.startsWith('https:');
  const sameSite = secure ? 'None' : 'Lax';
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=0${secure ? '; Secure' : ''}`;
}

export async function encodeSession(env: ApiBindings, session: Session): Promise<string> {
  const payload = btoa(
    JSON.stringify({ ownerId: session.ownerId, kind: 'anon' satisfies Session['kind'] }),
  );
  const sig = await hmac(authSecret(env), payload);
  return `${payload}.${sig}`;
}

export async function readSession(
  env: ApiBindings,
  cookieHeaderValue: string | undefined,
): Promise<Session | null> {
  const match = cookieHeaderValue?.match(new RegExp(`${COOKIE}=([^;]+)`));
  const token = match?.[1];
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = await hmac(authSecret(env), payload);
  if (expected !== sig) return null;
  const parsed = JSON.parse(atob(payload)) as Session;
  if (parsed.kind !== 'anon' || !parsed.ownerId) return null;
  return { ownerId: parsed.ownerId, kind: 'anon' };
}

export async function ensureAnon(_env: ApiBindings, existing: Session | null): Promise<Session> {
  if (existing?.kind === 'anon') return existing;
  const id = crypto.randomUUID();
  getMemoryDb().anon.set(id, { id, created_at: new Date().toISOString() });
  return { ownerId: id, kind: 'anon' };
}

function fromAddress(env: ApiBindings): string {
  const raw = env.AUTH_FROM_EMAIL ?? 'noreply@brim.invalid';
  return raw.includes('<') ? raw : `Brim <${raw}>`;
}

export async function sendAuthEmail(
  env: ApiBindings,
  to: string,
  subject: string,
  text: string,
): Promise<void> {
  const resendKey = env.RESEND_API_KEY;
  if (!resendKey) {
    if (isFixtureMode(env.BRIM_FIXTURES)) return;
    throw new Error('RESEND_API_KEY required to send mail');
  }
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromAddress(env), to, subject, text }),
  });
}

export const LOCAL_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

export function allowedWebOrigin(origin: string, webOrigin?: string): string | undefined {
  if (LOCAL_ORIGINS.includes(origin)) return origin;
  if (origin === 'https://brim-web-staging.pages.dev') return origin;
  if (origin === 'https://brim-web.pages.dev') return origin;
  if (/^https:\/\/[\w-]+\.brim-web-staging\.pages\.dev$/.test(origin)) return origin;
  if (/^https:\/\/[\w-]+\.brim-web\.pages\.dev$/.test(origin)) return origin;
  if (webOrigin && origin === webOrigin) return origin;
  return undefined;
}

export function trustedOrigins(env: ApiBindings): string[] {
  const origins = [
    ...LOCAL_ORIGINS,
    'https://brim-web-staging.pages.dev',
    'https://*.brim-web-staging.pages.dev',
    'https://brim-web.pages.dev',
    'https://*.brim-web.pages.dev',
  ];
  if (env.WEB_ORIGIN) origins.push(env.WEB_ORIGIN);
  return origins;
}
