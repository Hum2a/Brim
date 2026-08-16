# ADR 0003 — Cinematic UI override of spec §15

<table>
<tr>
<td><strong>Date</strong></td><td>2026-08-16</td>
</tr>
<tr>
<td><strong>Status</strong></td><td>

[![Override](https://img.shields.io/badge/status-accepted_override-C4472F?style=flat-square)](#)

</td>
</tr>
<tr>
<td><strong>Contradicts</strong></td><td>spec §15.1 · AGENTS.md web rules (glass, shadows, gradients, palette, motion)</td>
</tr>
</table>

> [!IMPORTANT]
> AGENTS.md says code that contradicts the spec is a bug in one of the two — **flag it, do not silently reconcile.** This file is that flag.

## Context

Spec §15.1 is an instrument: five colours, `--radius: 2px`, no gradients/glass/card shadows, amber only on the pump total, and the pump count-up as the only motion. The 2026-08-16 product request asked for a cinematic shadcn + Motion pass: glass, glows, extra hues, ambient light, and motion on every route.

## Decision

For this pass the **product request wins**. The UI may use:

- Extra ambient hues (`--night`, `--mist`, `--glow`, glass tokens)
- `backdrop-filter` glass panels, soft shadows, radial/vignette washes
- Motion (route transitions, staggers, layout, pump glow) via `motion/react`
- Real Radix shadcn for behaviour

Still required:

| Keep | Break |
|---|---|
| Dark only | Extra ambient hues |
| Archivo / Inter Tight / JetBrains Mono · `.tabular` | Glass + soft shadow + washes |
| `--radius: 2px` on controls | Stock `0.5rem` shadcn radius |
| Amber as pump-total hero (glow allowed **on that numeral**) | Amber everywhere |
| `prefers-reduced-motion` snaps; pump announces **once** | Ignoring reduced motion |
| Individual shadcn imports | Barrel imports |
| Browser never calls Google / DVLA / Fuel Finder | — |

## Consequences

The kitchen sink (`/kitchen-sink`) is the visual review gate. Reverting to §15 restraint is a later product decision, not a silent restyle.

§16 budget is initial JS **&lt; 150 kB gzip**. Measured after this pass (Vite production build, `LazyMotion` + route-split History/Account/KitchenSink):

| Asset | gzip | vs 150 kB |
|---|---:|---|
| Initial JS (`assets/index-*.js`) | **151.8 kB** | miss by 1.8 kB |
| CSS | 5.8 kB | — |
| Kitchen sink chunk | 19.4 kB | not in initial payload |
| Total JS+CSS + `sw.js` | 178.5 kB | — |

> [!WARNING]
> Do not treat a later trim as a silent pass of the gate. Re-run <kbd>npm run size</kbd> after UI changes.

**Index:** [ADR list](README.md)
