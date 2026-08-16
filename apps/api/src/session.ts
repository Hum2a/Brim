import type { Context } from 'hono';
import type { ApiBindings } from './env.js';
import { cookieHeader, encodeSession, ensureAnon, readSession, type Session } from './auth.js';
import { createAuth } from './db/client.js';

export async function betterAuthUser(env: ApiBindings, request: Request): Promise<Session | null> {
  const auth = createAuth(env, request);
  const ba = await auth.api.getSession({ headers: request.headers });
  if (!ba?.user) return null;
  const session: Session = { ownerId: ba.user.id, kind: 'user' };
  if (ba.user.email) session.email = ba.user.email;
  return session;
}

export async function resolveOwner(
  env: ApiBindings,
  request: Request,
): Promise<{ session: Session; setCookie?: string }> {
  const user = await betterAuthUser(env, request);
  if (user) return { session: user };

  const existing = await readSession(env, request.headers.get('Cookie') ?? undefined);
  const session = await ensureAnon(env, existing);
  if (existing?.kind === 'anon') return { session };
  return { session, setCookie: cookieHeader(await encodeSession(env, session), request.url) };
}

export async function ownerFromContext(c: Context<{ Bindings: ApiBindings }>): Promise<Session> {
  const resolved = await resolveOwner(c.env, c.req.raw);
  if (resolved.setCookie) c.header('Set-Cookie', resolved.setCookie);
  return resolved.session;
}
