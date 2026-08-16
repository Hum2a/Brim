# ADR 0003 — Cinematic UI override of spec §15

Date: 2026-08-16

## Status

Accepted (product request). Contradicts spec §15.1 and the AGENTS.md web rules on glass, shadows, gradients, palette size, and motion.

## Context

Spec §15.1 is an instrument: five colours, `--radius: 2px`, no gradients/glass/card shadows, amber only on the pump total, and the pump count-up as the only motion. The 2026-08-16 product request asked for a cinematic shadcn + Motion pass: glass, glows, extra hues, ambient light, and motion on every route.

AGENTS.md says code that contradicts the spec is a bug in one of the two — flag it, do not silently reconcile.

## Decision

For this pass the product request wins. The UI may use:

- Extra ambient hues (`--night`, `--mist`, `--glow`, glass tokens)
- `backdrop-filter` glass panels, soft shadows, radial/vignette washes
- Motion (route transitions, staggers, layout, pump glow) via `motion/react`
- Real Radix shadcn for behaviour

Still required:

- Dark only
- Archivo / Inter Tight / JetBrains Mono, `.tabular` on numbers
- `--radius: 2px` on controls (sharp glass, not stock `0.5rem`)
- Amber as the pump-total hero (glow is allowed on that numeral)
- `prefers-reduced-motion` snaps; pump announces the final value once
- Individual shadcn imports, never a barrel
- Browser never calls Google, DVLA, or Fuel Finder

## Consequences

The kitchen sink is the visual review gate. Reverting to §15 restraint is a later product decision, not a silent restyle.

§16 budget is initial JS < 150 kB gzip. Measured after this pass (Vite production build, `LazyMotion` + route-split History/Account/KitchenSink):

- Initial JS (`assets/index-*.js`): **151.8 kB gzip — miss** by 1.8 kB
- CSS: 5.8 kB gzip
- Kitchen sink chunk: 19.4 kB gzip (not in the initial payload)
- Total JS+CSS including route chunks and `sw.js`: 178.5 kB gzip

Do not treat a later trim as a silent pass of the gate. Re-run `npm run size` after UI changes.
