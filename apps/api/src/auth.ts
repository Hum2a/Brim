import { isFixtureMode } from "@brim/shared";
import type { ApiBindings } from "./env.js";
import { createAuth } from "./db/client.js";
import { getMemoryDb, type UserRow } from "./db/memory.js";
import { claimAnon } from "./db/repo.js";

export type Session = {
  ownerId: string;
  kind: "anon" | "user";
  email?: string;
};

const COOKIE = "brim_session";

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64(sig);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" }, key, 256);
  return `${b64(salt)}.${b64(bits)}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltB64, hashB64] = stored.split(".");
  if (!saltB64 || !hashB64) return false;
  const saltRaw = Uint8Array.from(atob(saltB64.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltRaw, iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  );
  return b64(bits) === hashB64;
}

export function cookieHeader(token: string, requestUrl: string): string {
  const secure = requestUrl.startsWith("https:");
  const sameSite = secure ? "None" : "Lax";
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=31536000${secure ? "; Secure" : ""}`;
}

export function clearCookieHeader(requestUrl: string): string {
  const secure = requestUrl.startsWith("https:");
  const sameSite = secure ? "None" : "Lax";
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=0${secure ? "; Secure" : ""}`;
}

export async function encodeSession(env: ApiBindings, session: Session): Promise<string> {
  const { secret } = createAuth(env);
  const payload = btoa(JSON.stringify(session));
  const sig = await hmac(secret, payload);
  return `${payload}.${sig}`;
}

export async function readSession(env: ApiBindings, cookieHeaderValue: string | undefined): Promise<Session | null> {
  const match = cookieHeaderValue?.match(new RegExp(`${COOKIE}=([^;]+)`));
  const token = match?.[1];
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const { secret } = createAuth(env);
  const expected = await hmac(secret, payload);
  if (expected !== sig) return null;
  return JSON.parse(atob(payload)) as Session;
}

export async function ensureAnon(_env: ApiBindings, existing: Session | null): Promise<Session> {
  if (existing) return existing;
  const id = crypto.randomUUID();
  getMemoryDb().anon.set(id, { id, created_at: new Date().toISOString() });
  return { ownerId: id, kind: "anon" };
}

export async function signup(_env: ApiBindings, email: string, password: string, anon?: Session | null): Promise<Session> {
  const db = getMemoryDb();
  if (db.usersByEmail.has(email.toLowerCase())) {
    throw new Error("email_taken");
  }
  const user: UserRow = {
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    passwordHash: await hashPassword(password),
    name: email.split("@")[0] ?? "driver",
    created_at: new Date().toISOString(),
  };
  db.users.set(user.id, user);
  db.usersByEmail.set(user.email, user.id);
  if (anon?.kind === "anon") claimAnon(anon.ownerId, user.id);
  return { ownerId: user.id, kind: "user", email: user.email };
}

export async function login(email: string, password: string, anon?: Session | null): Promise<Session> {
  const db = getMemoryDb();
  const id = db.usersByEmail.get(email.toLowerCase());
  const user = id ? db.users.get(id) : undefined;
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new Error("invalid_credentials");
  }
  if (anon?.kind === "anon") claimAnon(anon.ownerId, user.id);
  return { ownerId: user.id, kind: "user", email: user.email };
}

export async function sendAuthEmail(env: ApiBindings, to: string, subject: string, text: string): Promise<void> {
  const { resendKey } = createAuth(env);
  if (!resendKey) {
    if (isFixtureMode(env.BRIM_FIXTURES)) return;
    throw new Error("RESEND_API_KEY required to send mail");
  }
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Brim <noreply@brim.invalid>", to, subject, text }),
  });
}
