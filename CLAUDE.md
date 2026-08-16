# Generated from AGENTS.md. Do not edit. Run `npm run rules:sync`.

# AGENTS.md

Single source of truth for agent and contributor rules. Generated Cursor/Claude/Windsurf/Aider/Copilot files are derived from this document by `npm run rules:sync`. If generated files drift, `npm run rules:check` fails. Do not edit generated files by hand.

Human-facing docs: [README.md](README.md) · [docs hub](docs/README.md). This file stays terse on purpose.

`docs/design-spec.md` is authoritative. Code that contradicts the spec is a bug in one of the two: flag it, do not silently reconcile.

## Hard rules

These are not preferences. Violating them fails review.

1. `packages/engine` is PURE. No `fetch`, no `Date.now()`, no env reads, no I/O of any kind. Every input is passed in, including the current time. If it needs a network call, the design is wrong: stop and ask.
2. Per-request factories in Workers: `createDb(c.env.DATABASE_URL)`, `createAuth(c.env)`. NEVER a module-scope database or auth client, and never read `process.env` at module load. Workers bindings only exist per request and this crashes in production.
3. Vehicle registration marks are personal data under UK GDPR. A reg never appears in a URL path, a query string, a log line, an analytics event, or an error report. See spec §8.3.
4. This repo is PUBLIC from the first commit. No secrets in code, in fixtures, in tests, or in commit messages. Ever.
5. Script naming is `<domain>:<action>`: `dev:web`, `db:migrate`, `data:sync-fuel`, `test:rls`.
6. Never fake precision the inputs don't support. Every fallback in the estimate chain reports which tier it used and widens the confidence band. See spec §5.2 and §5.4.
7. No em dashes (Unicode U+2014). Use a colon, a comma, parentheses, or a spaced hyphen. `npm test` fails if any remain.

## Engine purity

`packages/engine` is a calculator, not a service. It imports only `packages/shared`. Time, temperature, prices, routes, and charges are inputs. The purity boundary exists so every conversion, tier, and charge-window decision can be tested without I/O, and so a Worker isolate cannot accidentally bake in a clock or a secret.

If a calculation seems to need `fetch`, `Date.now()`, `process.env`, `fs`, or a Cloudflare binding, stop. The caller should gather that data and pass it in.

## Workers factories

On Cloudflare Workers, `env` exists only for the current request. Create database and auth clients inside the request handler from `c.env`. A module-level singleton, or `process.env` at import time, will look fine locally and fail in production.

```ts
// correct
app.post('/v1/estimate', async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const auth = createAuth(c.env);
});

// forbidden
const db = createDb(process.env.DATABASE_URL);
```

## Registration-mark privacy

A VRM is personal data under UK GDPR when linkable to an individual.

- Never in a URL path or query string (`POST /v1/vehicles/resolve` with `{ vrm }` in the body only).
- Never in application logs, analytics, or error reports. All logging goes through the redacting logger.
- Stored only when the user has an account and chose to save the vehicle. Anonymous users' regs are resolved and discarded.
- Make/model entry is a first-class path, not a fallback. A reg is never required.
- Do not `console.log` objects typed with a `vrm` field.

## Public repository

No secrets in source, fixtures, tests, or commit messages. Forked PRs run against fixtures only. Fuel Finder, DVLA, Google, Neon, Better Auth, and Resend credentials live in Wrangler secrets and GitHub environments.

## Scripts

`<domain>:<action>` throughout. Data and database commands go through `scripts/with-env.mjs` so the target environment is explicit, never inferred:

```
node scripts/with-env.mjs <dev|staging|prod> -- <command>
```

The wrapper MUST fail loudly if no environment is given.

## Stack

- npm workspaces + Turborepo. npm ONLY. Never pnpm or yarn.
- React 19 + Vite (`apps/web`), Hono on Cloudflare Workers (`apps/api`)
- Neon Postgres + Drizzle ORM, PostGIS, RLS-first
- Better Auth, Resend
- Tailwind + shadcn/ui with mandatory token overrides (spec §15.1)
- TypeScript, project references, strict mode

## Engine (packages/engine)

Glob: `packages/engine/**`

- Zero runtime I/O. Lint must fail on `fetch`, `Date.now`, `process.env`, `fs`, and Cloudflare bindings.
- Consumption tier chain is strictly 0→4. Always return the tier label from spec §5.2.
- Missing optional inputs degrade a tier, append a reason, and still return a result. Never throw for missing optionals.
- Charges are accepted as an input array; this package does not resolve them.

## API (apps/api, workers/sync)

Glob: `apps/api/**`, `workers/sync/**`

- Per-request factories only.
- Third-party keys live only here. Web and extension never call Google, DVLA, or Fuel Finder.
- Structured logging with mandatory VRM redaction.
- `BRIM_FIXTURES=1` is read at this boundary, never inside `packages/engine`.

## Web (apps/web, packages/ui-kit, apps/extension)

Glob: `apps/web/**`, `packages/ui-kit/**`, `apps/extension/**`

- Browser never calls Google, DVLA, or Fuel Finder directly.
- shadcn for behaviour, Brim tokens for appearance. `--radius: 2px`. Amber (`--gauge`) once per screen.
- Numbers use `.tabular`. No gradients, no glass, no card shadows.
- Password fields use `@brim/ui-kit/input` (`Input type="password"` or `PasswordInput`). Never a bare `<input type="password">`. The control always includes a show/hide toggle (`type="button"`, labelled Show password / Hide password).
- Extension: URL parsing only, never DOM scraping. Manifest V3, minimal permissions.

## Data (data, scripts)

Glob: `data/**`, `scripts/**`

- Zone GeoJSON is versioned and dated with `source_url` and `verified_on`.
- Store raw Fuel Finder payloads beside normalised rows.
- `data:verify-zones` fails CI when a zone has not been re-verified in 180 days.
- All `db:*` and `data:*` commands use `with-env.mjs`.


