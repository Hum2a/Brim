const v = process.env.DATABASE_URL;
console.log(
  JSON.stringify({
    defined: v !== undefined,
    empty: v === "",
    len: (v ?? "").length,
    prefix: (v ?? "").slice(0, 12),
    brimEnv: process.env.BRIM_ENV ?? null,
  }),
);
