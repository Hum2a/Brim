import { isFixtureMode } from "@brim/shared";
import type { ApiBindings } from "../env.js";
import { getMemoryDb } from "./memory.js";

export function createDb(env: ApiBindings) {
  if (!isFixtureMode(env.BRIM_FIXTURES) && !env.DATABASE_URL) {
    throw new Error("createDb requires DATABASE_URL from the request env, not module scope");
  }
  return {
    memory: getMemoryDb(),
    connectionString: env.DATABASE_URL,
  };
}

export function createAuth(env: ApiBindings) {
  const secret = env.BETTER_AUTH_SECRET ?? (isFixtureMode(env.BRIM_FIXTURES) ? "fixture-dev-secret-not-for-production" : undefined);
  if (!secret) {
    throw new Error("createAuth requires BETTER_AUTH_SECRET from the request env");
  }
  return { secret, resendKey: env.RESEND_API_KEY };
}
