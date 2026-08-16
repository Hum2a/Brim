import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { createAuthMiddleware } from 'better-auth/api';
import { magicLink } from 'better-auth/plugins';
import { isFixtureMode } from '@brim/shared';
import type { ApiBindings } from '../env.js';
import { authSecret, readSession, sendAuthEmail, trustedOrigins } from '../auth.js';
import { claimAnon } from './repo.js';
import { getAuthMemory, getMemoryDb } from './memory.js';
import { account, schema, session, user, verification } from './schema.js';

export function createDb(env: ApiBindings) {
  if (!isFixtureMode(env.BRIM_FIXTURES) && !env.DATABASE_URL) {
    throw new Error('createDb requires DATABASE_URL from the request env, not module scope');
  }
  const db: {
    memory: ReturnType<typeof getMemoryDb>;
    connectionString?: string;
    drizzle?: ReturnType<typeof drizzle<typeof schema>>;
  } = {
    memory: getMemoryDb(),
  };
  if (env.DATABASE_URL) {
    db.connectionString = env.DATABASE_URL;
    db.drizzle = drizzle(neon(env.DATABASE_URL), { schema });
  }
  return db;
}

function authBaseURL(request?: Request): string {
  if (!request) return 'http://localhost:8787';
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function cookieAttributes(request?: Request) {
  const secure = request?.url.startsWith('https:') ?? false;
  return {
    sameSite: (secure ? 'none' : 'lax') as 'none' | 'lax',
    secure,
    httpOnly: true,
    path: '/',
  };
}

export function createAuth(env: ApiBindings, request?: Request) {
  const secret = authSecret(env);
  const db = createDb(env);
  const fixture = isFixtureMode(env.BRIM_FIXTURES);
  const database =
    !fixture && db.drizzle
      ? drizzleAdapter(db.drizzle, {
          provider: 'pg',
          schema: { user, session, account, verification },
          camelCase: true,
          transaction: false,
        })
      : memoryAdapter(getAuthMemory());

  return betterAuth({
    appName: 'Brim',
    secret,
    baseURL: authBaseURL(request),
    basePath: '/v1/auth',
    trustedOrigins: trustedOrigins(env),
    database,
    telemetry: { enabled: false },
    rateLimit: { enabled: !fixture },
    ...(fixture ? { logger: { disabled: true } } : {}),
    advanced: {
      useSecureCookies: request?.url.startsWith('https:') ?? false,
      defaultCookieAttributes: cookieAttributes(request),
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification: false,
      sendResetPassword: async ({ user: accountUser, url }) => {
        await sendAuthEmail(
          env,
          accountUser.email,
          'Reset your Brim password',
          `If an account exists for this address, open this link to set a new password:\n\n${url}\n`,
        );
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user: accountUser, url }) => {
        await sendAuthEmail(
          env,
          accountUser.email,
          'Verify your Brim email',
          `Confirm this address for your Brim account:\n\n${url}\n`,
        );
      },
    },
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await sendAuthEmail(
            env,
            email,
            'Sign in to Brim',
            `Open this link to sign in:\n\n${url}\n`,
          );
        },
      }),
    ],
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        const created = ctx.context.newSession;
        if (!created?.user || !request) return;
        const anon = await readSession(env, request.headers.get('Cookie') ?? undefined);
        if (anon?.kind === 'anon') claimAnon(anon.ownerId, created.user.id);
      }),
    },
  });
}
