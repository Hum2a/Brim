import { z } from 'zod';
import type { Context } from 'hono';
import type { ApiBindings } from './env.js';
import { betterAuthUser, ownerFromContext } from './session.js';
import { clearCookieHeader, readSession } from './auth.js';
import { createAuth } from './db/client.js';
import { claimAnon, deleteOwner, exportOwner } from './db/repo.js';

export async function sessionHandler(c: Context<{ Bindings: ApiBindings }>) {
  const user = await betterAuthUser(c.env, c.req.raw);
  if (user) return c.json({ session: user });
  const anon = await readSession(c.env, c.req.header('Cookie'));
  return c.json({ session: anon });
}

export async function claimAnonHandler(c: Context<{ Bindings: ApiBindings }>) {
  const user = await betterAuthUser(c.env, c.req.raw);
  if (!user) return c.json({ error: 'not_signed_in' }, 401);
  const body = z
    .object({ anonId: z.string().optional() })
    .safeParse(await c.req.json().catch(() => ({})));
  const cookieAnon = await readSession(c.env, c.req.header('Cookie'));
  const anonId =
    (body.success ? body.data.anonId : undefined) ??
    (cookieAnon?.kind === 'anon' ? cookieAnon.ownerId : undefined);
  if (!anonId) return c.json({ merged: false, moved: 0 });
  return c.json(claimAnon(anonId, user.ownerId));
}

export async function exportAccountHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await ownerFromContext(c);
  if (session.kind !== 'user') return c.json({ error: 'not_signed_in' }, 401);
  return c.json(exportOwner(session.ownerId));
}

export async function deleteAccountHandler(c: Context<{ Bindings: ApiBindings }>) {
  const user = await betterAuthUser(c.env, c.req.raw);
  if (!user) return c.json({ error: 'not_signed_in' }, 401);
  deleteOwner(user.ownerId);
  const auth = createAuth(c.env, c.req.raw);
  const ctx = await auth.$context;
  await ctx.internalAdapter.deleteUser(user.ownerId);
  c.header('Set-Cookie', clearCookieHeader(c.req.url));
  return c.json({ ok: true });
}

export async function betterAuthHandler(c: Context<{ Bindings: ApiBindings }>) {
  const auth = createAuth(c.env, c.req.raw);
  return auth.handler(c.req.raw);
}
