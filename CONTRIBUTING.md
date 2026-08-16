# Contributing to Brim

## Package manager

**npm only.** Do not use pnpm or yarn. There must be no `pnpm-lock.yaml` or `yarn.lock` at the repo root.

## Engine purity

`packages/engine` is a pure calculator. No `fetch`, no `Date.now()`, no environment reads, no filesystem, no Cloudflare bindings. If a change seems to need I/O, stop and ask — the design is wrong. Pass time, prices, routes, and charges in as arguments.

## Fixture mode

You can run the stack with **zero API keys**:

```bash
npm install
npm run dev:fixtures
```

`BRIM_FIXTURES=1` is read at the API boundary only. Every new external call must add a fixture in the same change.

## Data contributions

You do not need to write TypeScript to help. We welcome PRs that:

- correct a clean-air zone boundary (`data/zones/`)
- add a brand canonicalisation entry
- update an EV public-network tariff (`data/tariffs/`)

Include `source_url` and `verified_on` (ISO date) on zone and toll records.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add arrival state-of-charge verdicts
fix: widen confidence band when road composition is missing
docs: explain fixture mode in README
```

## Checks

```bash
npm run check
npm run rules:check
npm run doctor
```

Do not put registration marks, API keys, or personal data in the diff, fixtures, tests, or commit messages.
