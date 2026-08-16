# Brim - Build Prompt Kit (Foundation, P0–P4)

> Companion to `brim-specification-v0.2.md`. Keep the spec in the repo at `docs/design-spec.md`
> and **attach it to every prompt** - these phases reference it by section rather than restating it.

**How to use.** Run each numbered phase as its own Composer/Agent session, in order, committing
between each. Stop at every **CHECKPOINT** and review before continuing - do not chain them
unattended. Every phase must leave the repo green on `npm run check` and deployable.

**Five checkpoints:** A after P0 (foundation), B after P1 (engine), C after P2 (routing + API),
D after P3 (web app), E after P4 (persistence + auth). B and C are the two where a mistake is
expensive to unwind.

---

## Prompt 0 - Ground the agent

Paste this on its own, before Phase 0.1. Do not let it write code from this prompt.

```
This is Brim, a UK journey-cost estimator: fuel or EV energy, tolls, and clean-air charges
for a specific vehicle on a specific route. Read docs/design-spec.md in full before doing
anything. Context that applies to every phase of this build:

STACK
- npm workspaces + Turborepo. npm ONLY - never suggest or use pnpm or yarn.
- React 19 + Vite (apps/web), Hono on Cloudflare Workers (apps/api)
- Neon Postgres + Drizzle ORM, PostGIS enabled, RLS-first
- Better Auth, Resend
- Tailwind + shadcn/ui, with mandatory token overrides - see spec §15.1
- TypeScript throughout, project references, strict mode

HARD RULES - these are not preferences, and violating them fails review
1. packages/engine is PURE. No fetch, no Date.now(), no env reads, no I/O of any kind.
   Every input is passed in, including the current time. If it needs a network call,
   the design is wrong - stop and ask me.
2. Per-request factories in Workers: createDb(c.env.DATABASE_URL), createAuth(c.env).
   NEVER a module-scope database or auth client, and never read process.env at module
   load - Workers bindings only exist per request and this crashes in production.
3. Vehicle registration marks are personal data under UK GDPR. A reg never appears in a
   URL path, a query string, a log line, an analytics event, or an error report. See §8.3.
4. This repo is PUBLIC from the first commit. No secrets in code, in fixtures, in tests,
   or in commit messages. Ever.
5. Script naming is <domain>:<action> - dev:web, db:migrate, data:sync-fuel, test:rls.
6. Never fake precision the inputs don't support. Every fallback in the estimate chain
   reports which tier it used and widens the confidence band. See §5.2 and §5.4.

WORKFLOW
- Wait for each numbered phase before building it.
- At the end of each phase, run the phase's acceptance criteria and report results honestly.
  If something doesn't pass, say so rather than adjusting the criteria.
- If a phase's instructions conflict with docs/design-spec.md, stop and flag it - do not
  silently pick one.

Confirm you have read the spec and understood these rules before I send Phase 0.1.
Summarise rules 1 and 2 back to me in your own words.
```

---

# P0 - Foundation

## Phase 0.1 - Repo scaffold and workspaces

```
Scaffold the Brim monorepo. Structure per docs/design-spec.md §11.

Root: npm workspaces + Turborepo. TypeScript project references. Node 20+.

Create these workspaces, each with package.json, tsconfig.json extending the shared base,
and an index that exports nothing yet:

  apps/web            React 19 + Vite + TypeScript
  apps/api            Hono, Wrangler config, Cloudflare Workers
  apps/extension      empty placeholder, MV3 manifest stub only
  packages/engine     pure domain, zero runtime dependencies
  packages/routing    provider abstraction
  packages/shared     types, zod schemas, unit conversions, constants
  packages/ui-kit     Tailwind preset + shadcn theme (empty for now)
  packages/config     tsconfig/eslint/vitest base configs consumed by everything else

Also create empty directories with .gitkeep: data/zones, data/tolls, data/tariffs,
workers/sync, docs/adr, scripts.

packages/config exports:
  - tsconfig.base.json (strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes)
  - eslint base config (flat config)
  - vitest base config

Turborepo pipeline: build depends on ^build, test depends on ^build, lint and typecheck
independent, dev persistent and uncached.

Root scripts so far: dev:all, build, typecheck, lint, format, test, check, clean, reset.
`check` runs typecheck + lint + test.

Do NOT install Tailwind, shadcn, Drizzle, Better Auth or any Google SDK yet - later phases.
Do NOT write any application code. Stop after the scaffold compiles.

Acceptance criteria:
  - `npm install` succeeds from a clean clone
  - `npm run check` passes with zero code in the packages
  - `npm run build` succeeds
  - No pnpm-lock.yaml or yarn.lock anywhere
```

## Phase 0.2 - Quality floor, AGENTS.md, rules sync

```
Add the governance and quality layer.

1. AGENTS.md at the repo root. This is the SINGLE SOURCE for agent rules. Record:
   - the six hard rules from my grounding prompt, verbatim in substance
   - the <domain>:<action> script convention
   - the packages/engine purity boundary and why it exists
   - the per-request factory rule for Workers
   - the reg-plate privacy rule
   - the public-repo/no-secrets rule
   - that docs/design-spec.md is authoritative and code that contradicts it is a bug in
     one of the two - flag, don't silently reconcile

2. scripts/rules-sync.mjs generates agent rule files from AGENTS.md into:
   .cursor/rules/*.mdc (numbered, glob-scoped: 00_core, 10_engine, 20_api, 30_web, 40_data),
   CLAUDE.md, .windsurfrules, .aider.conf.yml, .github/copilot-instructions.md
   Expose as `rules:sync`. Add `rules:check` which regenerates to a temp dir and fails on
   drift. Wire rules:check into CI.

3. scripts/with-env.mjs - wrapper enforcing an explicit environment target for all data and
   database commands. Usage: `node scripts/with-env.mjs <dev|staging|prod> -- <command>`.
   It must FAIL LOUDLY if no environment is given. Never infer.

4. Add scripts: doctor (checks node version, npm not pnpm/yarn, required tooling),
   size (bundle size report), ship-it (check + build).

5. .editorconfig, prettier config, lint-staged + husky pre-commit running format + lint
   on staged files only.

6. GitHub Actions workflow `pr.yml`: install, check, rules:check, build. Runs on PRs.
   Conventional Commits enforced via commitlint.

Acceptance criteria:
  - `npm run rules:sync` produces all five rule targets from AGENTS.md
  - `npm run rules:check` passes immediately after sync and FAILS if AGENTS.md is edited
    without re-syncing
  - `node scripts/with-env.mjs -- echo hi` exits non-zero with a clear message
  - `npm run doctor` passes
```

## Phase 0.3 - Open-source scaffolding and fixture mode

```
This repo is public from the first commit. Set that up properly now - retrofitting it later
is how secrets leak into git history.

1. Licensing, per spec §20:
   - Root LICENSE: AGPL-3.0 (covers apps/*)
   - packages/engine/LICENSE, packages/shared/LICENSE, packages/routing/LICENSE: MIT
   - Each package.json carries the correct "license" field
   - README.md explains the split in three sentences

2. CONTRIBUTING.md covering: npm only, the engine purity rule, how to run with fixtures and
   no API keys, that data contributions (zone boundaries, brand canonicalisation, EV tariffs)
   are welcome and how to make one, and the conventional commit format.

3. CODE_OF_CONDUCT.md (Contributor Covenant) and SECURITY.md with a disclosure route.

4. .github/ISSUE_TEMPLATE for bug, data correction, and feature. PR template with a checklist
   including "contains no registration marks, API keys or personal data".

5. README.md: what Brim is, a screenshot placeholder, quickstart with fixtures, self-hosting
   pointer, and an explicit statement that Brim is free, has no ads, and will never sell
   journey or location data. That sentence is a constraint on future decisions, so make it
   prominent.

6. docs/self-hosting.md - stub with the intended sections.

7. FIXTURE MODE (spec §11.3). This is load-bearing for contribution, so build the mechanism
   now even though there is nothing to fixture yet:
   - packages/shared/src/fixtures/ with a typed registry
   - a `loadFixture(name)` helper that throws a clear error if BRIM_FIXTURES is not set
   - env flag BRIM_FIXTURES=1 read once at the API boundary, never inside packages/engine
   - script `dev:fixtures` that runs the whole stack in fixture mode
   The rule: `npm run dev:fixtures` must work for someone with zero API keys. Every later
   phase that adds an external call must add its fixture in the same phase.

8. Secret scanning: gitleaks in the PR workflow, plus a pre-commit hook. Configure it to
   also flag anything matching a UK registration mark pattern in staged diffs.

Acceptance criteria:
  - `npm run dev:fixtures` starts without any environment variables set
  - gitleaks runs clean on the current tree
  - Every package.json has a license field matching the split above
```

## Phase 0.4 - Hello world, deployed

```
Get both apps deployed end to end before any real code exists. Deployment problems found
now are cheap; found at P3 they are not.

1. apps/api: Hono app with GET /health returning { status, version, commit, fixtureMode }.
   Wrangler config for dev/staging/production environments. Nothing else.

2. apps/web: Vite React app, one page, calls /health and renders the result. No styling
   library yet - plain HTML is correct at this stage.

3. Local dev proxy so apps/web talks to apps/api without CORS gymnastics.

4. Deploy workflows:
   - .github/workflows/staging.yml - deploy both on merge to main
   - .github/workflows/production.yml - deploy on version tag, with a manual approval gate
   Scripts: deploy:staging, deploy:prod, deploy:preview.

5. Add Changesets for versioning.

Acceptance criteria:
  - Staging URL serves the web app, which successfully renders the API's /health response
  - `npm run deploy:preview` works from a clean clone with only Cloudflare credentials
  - No secrets are committed; all config via Wrangler secrets and GitHub environments
```

---

> ## ⛔ CHECKPOINT A - review before P1
>
> Confirm: clean clone → `npm install` → `npm run dev:fixtures` works with no env vars.
> Staging is live. `rules:check` fails correctly on drift. Licence split is right in every
> package.json. Git history contains no secrets - check before the repo goes public, not after.

---

# P1 - The engine

> This is where the product's correctness is decided. Take these four phases slowly. A wrong
> conversion constant here surfaces as a user's £40 estimate being £52 and there is no test
> at any other layer that would catch it.

## Phase 1.1 - packages/shared: units, constants, types

```
Read docs/design-spec.md §5 in full first.

Build packages/shared. Pure TypeScript, no runtime dependencies except zod.

1. src/units.ts - conversions, each with its exact constant named and sourced in a comment:
     IMPERIAL_GALLON_LITRES = 4.54609
     MILE_KM = 1.609344
     mpgToL100km / l100kmToMpg  using 282.481
     milesPerKwhToKwhPer100km   using 62.137
     Plus km/miles, litres/gallons, pence/pounds helpers.
   Every conversion must be exact-inverse round-trip safe to 1e-9. Test this.

2. src/constants/emissions.2025.ts - DEFRA/DESNZ direct tailpipe kg CO2e per litre for
   petrol and diesel, with a DATASET_YEAR export and the source URL in a comment.
   File is named by year deliberately: these are re-based annually and must never be inline.

3. src/constants/corrections.ts - the tier-2 real-world correction factors from §5.2
   (WLTP 1.12, NEDC 1.25, WLTP EV 1.15), the road-shape modifiers from §5.3 for both ICE
   and EV, the EV temperature derating table from §5.5, and charging efficiency defaults.
   Every value carries a comment saying it is a tunable starting constant, not a measured
   truth, and pointing at §13.4.

4. src/types.ts + zod schemas for: Vehicle, VehicleProfile, ConsumptionTier, Estimate
   (the full §5.8 payload), Charge, Warning, PriceSource, RouteResult.
   Define Charge and Warning fully now even though the charge resolver is P7 - the Estimate
   payload shape must be stable from here so nothing downstream has to change later.

5. src/maps-url.ts - parser for Google Maps directions URLs per §10.2. Extracts origin,
   destination, waypoints, travel mode from the URL only. Never any DOM assumptions.
   Handle: encoded place names, lat/lng pairs, plus codes, multi-waypoint, and the !3e
   travel mode flag. Return a discriminated result, never throw on malformed input.

Acceptance criteria:
  - Round-trip tests pass for every conversion at 1e-9
  - A table test of 20 known mpg↔l/100km pairs matches published values
  - maps-url parser handles a corpus of at least 15 real captured URLs, including three
    malformed ones that must return a typed failure rather than throwing
```

## Phase 1.2 - Engine: ICE consumption and the tier chain

```
Read §5.1–5.4. Build packages/engine. PURE - no fetch, no Date.now(), no env. The current
time is an input parameter wherever it is needed.

1. src/consumption/resolve.ts - the tier chain from §5.2. Signature roughly:

     resolveConsumption(inputs: {
       calibration?: Calibration
       userEntered?: { value: number; unit: ConsumptionUnit }
       official?: { value: number; unit: ConsumptionUnit; cycle: 'WLTP'|'NEDC' }
       classAverage?: { value: number; unit: ConsumptionUnit }
       providerEstimate?: { litres: number }
     }): ResolvedConsumption   // { value, unit, tier, label, reasons[] }

   Tier selection is strictly ordered 0→4. Calibration only qualifies for tier 0 with
   sampleCount >= 3. Every tier returns a human-readable label from §5.2 and appends a
   reason string.

2. src/consumption/roadShape.ts - apply the §5.3 modifiers given a road composition
   (fractions of urban/rural/motorway summing to 1). If composition is absent, return the
   value unmodified AND emit a confidence downgrade - never silently assume.

3. src/confidence.ts - band computation. Band width is a function of tier plus a widening
   term per fallback used. Tier 0 ±4%, tier 1 ±8%, tier 2 ±10%, tier 3 ±20%, tier 4 ±25%,
   each widened by 3 percentage points per recorded fallback.

4. src/estimate/ice.ts - litres, cost, CO2 per §5.1, returning point/low/high.

Rounding rule, applied everywhere: never present more precision than the band supports.
Money rounds to the pound when the band is wider than £2, to ten pence otherwise.

Acceptance criteria:
  - 100% branch coverage on the tier selection logic - this is a hard gate, not a target
  - A fixture set of 10 real vehicles with hand-verified expected litres and cost at a
    fixed price and distance, each asserted to within 0.01
  - Property test: adding a fallback never narrows the band
  - Attempting to import anything with I/O into packages/engine fails lint (add the rule)
```

## Phase 1.3 - Engine: the EV model

```
Read §5.5–5.7. This is the part competitors get wrong, so be precise.

1. src/estimate/ev.ts implementing §5.5 exactly:
     - batteryKwhUsed from distance and effective kWh/100km
     - gridKwhDrawn = batteryKwhUsed / chargingEfficiency  (AC 0.88, DC 0.94)
     - cost is billed on GRID kWh, not battery kWh - this is the detail everyone misses
     - CO2 uses BATTERY kWh against grid intensity in gCO2/kWh

2. Temperature derating from §5.5. Applied only when a forecast temperature for the journey
   window is supplied. When absent, skip it and append a reason string - do not assume 15°C
   and pretend. Halve the uplift when the vehicle profile indicates a heat pump.

3. src/estimate/arrival.ts - arrival state of charge per §5.7:
     arrivalPct = startPct − (batteryKwhUsed / usableBatteryKwh × 100)
   Returns verdict 'comfortable' (>20%), 'tight' (10–20%), 'insufficient' (<10%), and for
   insufficient also a shortfallKwh. Do NOT compute or suggest charging stops - out of
   scope per §4.2, and a bad charging recommendation is worse than none.

4. PHEV handling: treat as a two-mode vehicle - electric until the battery is exhausted,
   then petrol. Split the distance accordingly and return both components. If the user has
   not supplied a starting charge for a PHEV, fall back to the official combined figure and
   flag low confidence, because PHEV real-world consumption depends almost entirely on
   charging behaviour.

Acceptance criteria:
  - Charging losses verified: a 50 kWh battery need at 0.88 efficiency bills 56.8 kWh
  - Temperature table applied at every boundary value including exactly 0, 5 and 15°C
  - Arrival SoC verdict boundaries tested at exactly 10% and 20%
  - PHEV split tested across: battery-only trip, battery-exhausted trip, no-charge-supplied
```

## Phase 1.4 - Engine: estimate assembly

```
Read §5.8. Assemble the pieces into the single public entry point.

src/index.ts exports one primary function:

  computeEstimate(input: EstimateInput): Estimate

It orchestrates: consumption resolution → road shape → propulsion-specific estimate →
confidence bands → cost assembly → reasons and warnings. It accepts a `charges: Charge[]`
parameter and includes them in totals, but does NOT resolve them - the charge resolver
lands at P7 and callers pass an empty array until then.

Requirements:
  - Deterministic. Same input, same output, always. No clock, no randomness.
  - `reasons` explains every non-obvious decision in plain English aimed at a driver,
    not a developer: "Adjusted the official figure up 12% - official tests run optimistic"
    not "applied WLTP_CORRECTION 1.12"
  - `warnings` carries anything the user must act on: unsupported vehicle class, missing
    inputs, stale assumptions
  - Never throws for missing optional inputs. Degrade a tier, add a reason, return a result.
    The product must produce an honest answer given only a distance and a fuel type.

Also write docs/adr/0001-engine-purity.md recording why the engine takes time and
temperature as inputs rather than reading them.

Acceptance criteria:
  - ≥95% line coverage across packages/engine, 100% on tier selection
  - A golden-file test: 12 complete scenarios (petrol/diesel/BEV/PHEV × calibrated/official/
    unknown) with committed expected JSON output, so any future change to constants shows
    up as an explicit diff to review
  - computeEstimate with only { distanceMeters, propulsion } returns a valid tier-3 or
    tier-4 estimate with appropriate reasons, and does not throw
```

---

> ## ⛔ CHECKPOINT B - review before P2
>
> The most important review in the build. Hand-check three golden-file outputs against your
> own arithmetic. Verify the grid-vs-battery kWh distinction is right. Confirm the engine has
> zero I/O imports. Everything downstream trusts these numbers.

---

# P2 - Routing and the API

## Phase 2.1 - packages/routing: interface and OSRM adapter

```
Read §11.2 and §6. Build the provider abstraction FIRST, and the free provider before the
paid one, so the expensive path can never become load-bearing by accident.

1. src/types.ts - the RoutingProvider interface from §11.2, with a capabilities descriptor
   ({ tolls, fuelEstimate, roadComposition, alternatives }).

2. src/providers/osrm.ts - OSRM adapter. Distance, duration, encoded polyline.
   capabilities: all false except alternatives. Configurable base URL.

3. src/providers/fixture.ts - replays recorded responses, used by BRIM_FIXTURES=1.
   Include recorded routes for at least six real UK journeys of varying length, including
   one that passes through central London and one Scottish route - later phases need these.

4. src/polyline.ts - encode/decode Google's polyline algorithm, plus Ramer–Douglas–Peucker
   simplification. Needed by §9A and §9B later. Pure, tested against known fixtures.

5. Provider selection is explicit at the call site, never implicit. No default provider
   constant that could silently become Google.

Acceptance criteria:
  - Polyline decode matches a known reference implementation on 10 fixtures
  - The fixture provider satisfies the full interface and dev:fixtures uses it
  - packages/routing has no Google dependency yet - verify by inspecting package.json
```

## Phase 2.2 - Google Routes adapter

```
Read §6.1. IMPORTANT: that request shape is written from secondary sources and the fuel and
toll fields moved during the API's Preview period.

FIRST TASK, before writing the adapter: fetch the current Routes API documentation and
verify the exact field names for computeRoutes, the field mask entries for
fuelConsumptionMicroliters and tollInfo, the extraComputations enum values, and the
routeModifiers.vehicleInfo.emissionType values. Report what you find and flag any
discrepancy with §6.1 before proceeding. If UK toll coverage looks thin or unreliable,
say so - we may drop TOLLS from extraComputations entirely and rely on our own toll table
at P7, which would save SKU cost.

Then build src/providers/google.ts:
  - Minimal field mask. Every field costs money; request nothing speculative.
  - Two modes: 'basic' (distance/duration/polyline only, cheap SKU) and 'advanced'
    (adds TRAFFIC_AWARE_OPTIMAL, fuel, tolls). The mode is a parameter, never inferred.
  - Extract road composition for §5.3 if available; if not, report the capability as false
    rather than fabricating a breakdown.
  - Typed error handling for quota, auth and invalid-request, surfaced distinctly so the
    failover logic at 2.3 can distinguish "we're out of budget" from "bad input".

Record findings in docs/adr/0002-routes-api-fields.md, including the date checked.

Acceptance criteria:
  - Adapter satisfies the interface with correct capabilities per mode
  - Field mask contains no field the estimate doesn't consume - check this by hand
  - Fixtures recorded for both modes, with any account-identifying data scrubbed
  - Unit tests run entirely against fixtures; no live calls in the test suite
```

## Phase 2.3 - Cache, tier strategy, spend ceiling

```
Read §14 carefully. This subsystem decides whether a free product survives contact with
users, so implement all seven controls, not the easy ones.

1. src/cache.ts - route cache keyed on hash(originRounded, destRounded, mode, timeBucket,
   provider). Coordinates rounded to ~100m (4 decimal places is too fine; use 3). Time
   bucket = hour-of-week for traffic-aware, absent for distance-only. TTL 6h traffic-aware,
   30d distance-only. KV as hot store, Neon as durable - but Neon is not wired yet, so
   define the interface and implement KV now with a no-op durable layer to fill in at P4.

2. src/strategy.ts - provider and mode selection:
     - Vehicle profile present (tier 0–3 achievable) → basic mode. This is the common case
       and MUST NOT hit the advanced SKU.
     - No vehicle profile at all → advanced mode for the provider fuel estimate (tier 4)
     - Explicit user request for eco comparison → advanced
   Log which branch was taken as a metric. Assert in tests that a profiled vehicle never
   selects advanced.

3. src/budget.ts - monthly spend tracking against a configured ceiling, with automatic
   failover to the OSRM provider when exceeded. Failover degrades confidence and adds a
   reason string; it never returns an error to the user. Alert thresholds at 60% and 85%.

4. Per-IP and per-session rate limiting using the Workers rate-limiting binding.

Acceptance criteria:
  - Test proving a request with a calibrated vehicle profile never reaches the Google
    advanced mode
  - Cache hit rate measurable; a repeated identical request makes exactly one provider call
  - Simulated ceiling breach returns a valid estimate from OSRM with a degraded tier and a
    reason string, and does not throw
```

## Phase 2.4 - apps/api: the estimate endpoint

```
Read §13. Build the Hono API. Per-request factories only - no module-scope clients.

1. POST /v1/estimate per §13, zod-validated at the boundary. Accepts vehicleInline (no
   persistence yet - P4 adds vehicleId lookup). Orchestrates: routing provider → engine →
   response. Charges array is empty until P7; wire the parameter through now.

2. POST /v1/estimate/from-maps-url - parses via packages/shared maps-url, delegates.

3. GET /health extended with provider status and cache stats.

4. Structured logging with a MANDATORY redaction filter per §8.3:
   - Redacts anything matching a UK registration mark pattern anywhere in a log payload
   - Redacts any field named vrm, reg, registration, plate at any nesting depth
   - Write a test that logs an object containing a reg and asserts the output does not
     contain it. This test is a permanent gate.
   - Add an ESLint rule banning direct console.* in apps/api and packages/* - all logging
     goes through the redacting logger

5. Error responses: typed, no stack traces in production, no internal identifiers.

6. CORS restricted to known origins. Rate limits from 2.3 applied.

Acceptance criteria:
  - `curl` against staging returns a complete Estimate for a real UK journey with an
    inline petrol vehicle, and again for a BEV with a battery size and starting charge
  - The redaction test passes and fails correctly when the filter is removed
  - dev:fixtures serves the full endpoint with no API keys present
  - p95 under 800ms warm on staging
```

---

> ## ⛔ CHECKPOINT C - review before P3
>
> Verify the tier strategy on a live staging request: confirm in the logs that a profiled
> vehicle used basic mode. Check the actual Google Cloud billing console after a dozen
> requests - the number should be near zero. Confirm the redaction filter works by
> deliberately sending a reg through and grepping the logs.

---

# P3 - The web app

## Phase 3.1 - Tailwind, shadcn, and the Brim theme

```
Read §15 in full, especially §15.1.

Install Tailwind and shadcn/ui in apps/web, with the shared theme in packages/ui-kit.

CRITICAL: stock shadcn is instantly recognisable and shipping it untouched would undercut
the entire point of the design. The token overrides in §15.1 are mandatory, not suggestions.

1. packages/ui-kit/tailwind-preset.ts consumed by apps/web:
   - The five-colour palette from §15, as CSS custom properties AND Tailwind theme colours
   - --radius: 2px. Not 0.5rem. Instruments have sharp corners.
   - Fonts: Archivo Expanded (display), Inter Tight (body), JetBrains Mono (data), loaded
     via self-hosted woff2 with font-display: swap and preload hints for the display face
   - A `.tabular` utility applying font-variant-numeric: tabular-nums, used by every number
     in the product

2. shadcn components installed individually (never barrel-imported, per §16): button, input,
   select, dialog, popover, command, tabs, form, toast, drawer, skeleton, tooltip.
   Immediately re-theme each against the tokens. Review each one rendered and confirm it
   does not look like default shadcn.

3. Dark is the only mode. --forecourt is the ground. Do not build a light theme.

4. A /kitchen-sink dev-only route rendering every themed component, so drift is visible.

Acceptance criteria:
  - Screenshot the kitchen sink. If it looks like a stock shadcn demo, the phase failed -
    revise before continuing
  - Amber (--gauge) on --forecourt measured at ≥4.5:1 for the display numeral size
  - Fonts self-hosted, no external font CDN request
  - Initial CSS under 20kB gzipped
```

## Phase 3.2 - The pump readout

```
Read §15 signature element. This is hand-built, not a shadcn component, and it is where the
design's one risk is spent. Build it alone, in its own phase, and get it right.

packages/ui-kit/src/PumpReadout.tsx

  - Displays the journey total in segmented monospace, counting up from zero exactly as a
    forecourt pump does while filling
  - Roughly 600ms, easing out - it should decelerate into the final value, not stop dead
  - Digits are tabular so the layout never reflows during the count
  - Under prefers-reduced-motion, snaps immediately to the final value with no animation
  - Announces the FINAL value once via a polite live region - not on every tick, which
    would flood a screen reader
  - Accepts a currency and a unit so it can render pounds, litres or kWh
  - Amber (--gauge). This is the one place amber appears on the screen.

Build a Storybook-less demo route showing it at various magnitudes (£4, £47, £412) and
confirm no layout shift between them.

Acceptance criteria:
  - No cumulative layout shift during the count (measure it)
  - Screen reader announces the final value exactly once
  - prefers-reduced-motion honoured, verified in devtools
  - Runs at 60fps on a mid-range Android device profile
```

## Phase 3.3 - The estimate flow

```
Read §5.4, §15.2 and §16. Build the core product surface.

1. Origin/destination inputs with place autocomplete. Use the routing provider's geocoding
   through OUR API - the browser never calls Google directly (§11.1).

2. Inline vehicle entry: propulsion type, then the fields that propulsion needs. Petrol/
   diesel → mpg and tank size. BEV → mi/kWh, usable battery kWh, starting charge. PHEV →
   both plus starting charge. Progressive disclosure; never show a BEV user a tank size.

3. Departure time picker, defaulting to now. It matters for traffic and, from P7, for
   charge windows - so it exists from the start.

4. Results view:
   - PumpReadout with the total as the hero
   - Beneath it, the confidence band per §5.4 - "£38–£47", quiet, in mono
   - The consumption tier label ("Based on your fill-ups" / "Official figure, adjusted")
     always visible. Never hide how we got there.
   - Reasons in a collapsible section, in the driver-facing plain English from §1.4
   - Warnings surfaced prominently, in --warning, never collapsed
   - For BEV: arrival state of charge with the §5.7 verdict copy
   - A charges section, rendering empty-with-explanation until P7

5. Copy per §15.2. Empty states invite. Errors say what happened and what to do.

6. Loading: skeleton, not a spinner. The estimate takes under a second warm.

Acceptance criteria:
  - Full keyboard path from landing to result, with visible focus throughout
  - A petrol journey and a BEV journey both render correctly against staging
  - Time from landing to first estimate under 45 seconds for a new user (time yourself)
  - Lighthouse ≥90 mobile on this route
```

## Phase 3.4 - Maps URL entry, PWA shell, and the a11y pass

```
1. Paste-a-Maps-link field on the landing surface, using packages/shared maps-url. On a
   valid parse, populate origin and destination and estimate immediately. On a malformed
   link, say what was wrong and offer manual entry - never a bare "invalid URL".

2. Web Share Target API registration so the installed PWA appears in Android's share sheet
   when sharing a Maps link. This is the primary mobile path per §10.3 and needs no
   extension at all.

3. PWA: manifest, icons, service worker caching the app shell and the last estimate.
   Offline shows the last estimate with a clear stale banner; new estimates require network
   and say so.

4. Accessibility pass against §16: WCAG 2.2 AA across the whole flow. Verify colour contrast
   at every size used, focus order, form labelling and error association, and that the
   results region is announced on update.

5. Performance pass: route-split, lazy-load anything map-related, verify initial JS under
   150kB gzipped. Report the actual number.

Acceptance criteria:
  - Sharing a Maps link from an Android phone into the installed PWA produces an estimate
  - axe-core reports zero violations on the estimate flow
  - Initial JS under 150kB gzipped - report the figure, don't just assert it
  - Lighthouse ≥90 mobile, all categories ≥90
```

---

> ## ⛔ CHECKPOINT D - review before P4
>
> Use it on your phone, on a real journey you're about to make, and check the number against
> what you actually spend. This is the first point where Brim is a product rather than a
> codebase, and it is the right moment to decide whether the estimate feels trustworthy
> before building persistence on top of it.

---

# P4 - Persistence, auth, accounts

## Phase 4.1 - Drizzle schema and RLS

```
Read §12. RLS-first: every user-scoped table gets its policy in the same migration that
creates it. Not a follow-up.

1. Neon setup with PostGIS enabled. Drizzle schema implementing §12 in full, including the
   tables not yet used (zones, tolls, grid_intensity) so later phases add data, not DDL.

2. RLS policies:
   - Owner-scoped: vehicles, tariffs, fill_ups, journeys, calibrations
   - Public-read / service-write: stations, station_prices, zones, tolls, vca_vehicles,
     grid_intensity
   - The RLS subject is an owner id that resolves to either a user id or an anon profile id,
     so the same policy covers both. Design this carefully - it is what makes
     claim-on-signup a simple owner rewrite at 4.3.

3. scripts: db:generate, db:migrate, db:studio, db:seed - all routed through with-env.mjs.

4. db:force-rls - fails if any table lacks RLS enabled and at least one policy. Wire into CI.

5. test:rls - a suite that connects as two different subjects and asserts every cross-tenant
   read, update and delete is denied. Gated in CI.

6. Wire the durable layer of the route cache from 2.3 into Neon.

Acceptance criteria:
  - db:force-rls fails when you deliberately create an unpolicied table, and passes otherwise
  - test:rls proves user A cannot read, modify or delete any row owned by user B, for every
    owner-scoped table
  - Neon branch-per-PR working in CI
```

## Phase 4.2 - Better Auth, anonymous sessions, Resend

```
Read §10.4. Anonymous-first: a first-time visitor gets an estimate with no signup. The
account prompt appears only when it buys something.

1. Better Auth in apps/api via createAuth(c.env) - per-request factory, never module scope.
   Use Better Auth's own CLI to generate its tables; do not hand-write them.

2. Email/password plus one social provider, plus magic links via Resend. Verification and
   password reset emails through Resend with plain-text-first templates.

3. Anonymous sessions: on first estimate, mint a signed anon session, create an
   anon_profiles row, set an httpOnly cookie. This is the RLS subject for anonymous users.
   It must let someone save a vehicle and see history before ever signing up.

4. Auth UI in apps/web using the themed shadcn form components. The signup prompt appears
   contextually - at save-vehicle, at log-fill-up, at sync-across-devices - and never as an
   interstitial before the first estimate.

Acceptance criteria:
  - A brand-new visitor completes an estimate and saves a vehicle without an account
  - Signup, verification, login, logout and password reset all work on staging
  - Auth tables are Better Auth's generated ones, not hand-written
  - No module-scope auth client anywhere - grep for it
```

## Phase 4.3 - Claim on signup, vehicles, tariffs

```
1. POST /v1/auth/claim-anon - on signup or first login from a session holding an anon
   profile, rewrite owner ids from the anon profile to the user id, inside a single
   transaction, then mark the anon profile claimed. Nothing is lost and nothing is
   duplicated. If the user already has an account and signs in on a device with an anon
   profile, merge rather than discard, and prefer the account's data on conflict.

2. Vehicle CRUD per §13, with the §8.2 UI contract in mind even though reg lookup is P9 -
   the vehicle record already carries euro_status and its source, and manual make/model
   entry is a first-class path, not a fallback.

3. Tariff CRUD for EV users: home rate, off-peak rate and window, one default per vehicle.

4. Vehicle selector in the estimate flow, replacing inline entry for signed-in users while
   keeping inline entry available for anonymous ones.

Acceptance criteria:
  - Estimate anonymously, save a vehicle, sign up → the vehicle is present on the account
  - Same flow on a second device with an existing account → merge, no duplicates, no loss
  - test:rls still passes with the claim path exercised
```

## Phase 4.4 - Journeys, history, export

```
1. POST /v1/journeys saves an estimate with its full payload, including the estimate_json
   and charges_json snapshots. Store the snapshot, not a recomputation - a journey's cost
   is what it was on the day, and constants change.

2. GET /v1/journeys - paginated history, newest first, with vehicle and total.

3. GET /v1/journeys/export - CSV for expenses. Columns: date, from, to, miles, vehicle,
   energy cost, charges, total, HMRC approved amount, difference. This is the secondary
   user's whole reason for being here (§3), so get the columns right for a real expense
   claim and test it opens cleanly in Excel.

4. HMRC AMAP comparison surfaced in the results view: 45p/mile to 10,000 miles, 25p after.
   The 10,000-mile threshold is per tax year and cumulative, so it needs the user's
   year-to-date mileage from their journey history - compute it, don't assume the first rate.

5. History UI: list, detail, delete. Deleting is immediate and permanent, with confirmation.

Acceptance criteria:
  - A saved journey's displayed cost never changes after a constants update
  - CSV opens correctly in Excel and Google Sheets, with no encoding or delimiter issues
  - HMRC threshold crossing tested: a user at 9,900 miles adding a 200-mile journey gets
    the split rate, not a flat one
  - Full data export and account deletion available from the UI per §16
```

---

> ## ⛔ CHECKPOINT E - end of foundation
>
> Brim is now a real product: estimate, account, vehicles, history, export. Before P5,
> use it for a fortnight of your own journeys and compare against actual spend. That
> evidence should decide whether P5 (live prices) or P7 (charges) goes next - the spec
> argues for charges as the differentiator, but your own usage is better evidence than
> the spec's guess.

---

## After P4

P5 onward get their own kits, written when you reach them so they can incorporate what
P0–P4 actually taught you:

- **P5** Fuel Finder ingestion and normalisation - expect the dirty-data work in §7.2 to
  take longer than it looks
- **P6** EV tariffs, grid carbon intensity, temperature derating wired to a forecast
- **P7** Charges: toll table, zone geometry, compliance engine. Highest test bar in the
  project, and the phase that makes Brim unlike anything else
- **P8** Cheapest fill on route
- **P9** Reg lookup - the fiddliest work in the build, deliberately last
- **P10** Fill-up logging and calibration, which closes the loop back to tier 0
- **P11** Extension, polish, Herald surface

Update `docs/design-spec.md` whenever a phase contradicts it. The spec is a living document,
and a phase that taught you something the spec got wrong is not finished until the spec
reflects it.
