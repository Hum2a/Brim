/** @type {import('drizzle-kit').Config} */
export default {
  schema: './apps/api/src/db/schema.ts',
  out: './apps/api/src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://127.0.0.1/brim',
  },
};
