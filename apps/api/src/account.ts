import { z } from "zod";
import type { Context } from "hono";
import type { ApiBindings } from "./env.js";
import {
  clearCookieHeader,
  cookieHeader,
  encodeSession,
  login,
  readSession,
  sendAuthEmail,
  signup,
} from "./auth.js";
import { claimAnon, deleteOwner, exportOwner } from "./db/repo.js";

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function sessionHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await readSession(c.env, c.req.header("Cookie"));
  return c.json({ session });
}

export async function signupHandler(c: Context<{ Bindings: ApiBindings }>) {
  const parsed = credentials.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid_request" }, 400);
  const anon = await readSession(c.env, c.req.header("Cookie"));
  try {
    const session = await signup(c.env, parsed.data.email, parsed.data.password, anon);
    c.header("Set-Cookie", cookieHeader(await encodeSession(c.env, session), c.req.url));
    return c.json({ session });
  } catch (err) {
    const code = err instanceof Error ? err.message : "error";
    return c.json({ error: code }, 400);
  }
}

export async function loginHandler(c: Context<{ Bindings: ApiBindings }>) {
  const parsed = credentials.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid_request" }, 400);
  const anon = await readSession(c.env, c.req.header("Cookie"));
  try {
    const session = await login(parsed.data.email, parsed.data.password, anon);
    c.header("Set-Cookie", cookieHeader(await encodeSession(c.env, session), c.req.url));
    return c.json({ session });
  } catch {
    return c.json({ error: "invalid_credentials" }, 401);
  }
}

export async function logoutHandler(c: Context<{ Bindings: ApiBindings }>) {
  c.header("Set-Cookie", clearCookieHeader(c.req.url));
  return c.json({ ok: true });
}

export async function claimAnonHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await readSession(c.env, c.req.header("Cookie"));
  if (!session || session.kind !== "user") return c.json({ error: "not_signed_in" }, 401);
  const body = z.object({ anonId: z.string() }).safeParse(await c.req.json().catch(() => ({})));
  const anonId = body.success ? body.data.anonId : undefined;
  if (!anonId) return c.json({ error: "invalid_request" }, 400);
  return c.json(claimAnon(anonId, session.ownerId));
}

export async function magicLinkHandler(c: Context<{ Bindings: ApiBindings }>) {
  const parsed = z.object({ email: z.string().email() }).safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid_request" }, 400);
  await sendAuthEmail(
    c.env,
    parsed.data.email,
    "Sign in to Brim",
    "Open Brim and sign in with your email and password. This is a plain-text magic-link stand-in until Resend templates are wired in production.",
  );
  return c.json({ ok: true });
}

export async function resetHandler(c: Context<{ Bindings: ApiBindings }>) {
  const parsed = z.object({ email: z.string().email() }).safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid_request" }, 400);
  await sendAuthEmail(
    c.env,
    parsed.data.email,
    "Reset your Brim password",
    "If an account exists for this address, set a new password from the sign-in screen. This message is plain text on purpose.",
  );
  return c.json({ ok: true });
}

export async function exportAccountHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await readSession(c.env, c.req.header("Cookie"));
  if (!session) return c.json({ error: "not_signed_in" }, 401);
  return c.json(exportOwner(session.ownerId));
}

export async function deleteAccountHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await readSession(c.env, c.req.header("Cookie"));
  if (!session) return c.json({ error: "not_signed_in" }, 401);
  deleteOwner(session.ownerId);
  c.header("Set-Cookie", clearCookieHeader(c.req.url));
  return c.json({ ok: true });
}
