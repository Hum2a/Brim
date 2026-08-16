# ADR 0005: Purposeful motion, visual restraint restored

<table>
<tr>
<td><strong>Date</strong></td><td>2026-08-16</td>
</tr>
<tr>
<td><strong>Status</strong></td><td>

[![Accepted](https://img.shields.io/badge/status-accepted-1F6F63?style=flat-square)](#)

</td>
</tr>
<tr>
<td><strong>Supersedes</strong></td><td>[0003](0003-cinematic-ui-override.md)</td>
</tr>
<tr>
<td><strong>Contradicts</strong></td><td>spec §15.1 "pump count-up is the only motion"</td>
</tr>
</table>

> [!IMPORTANT]
> AGENTS.md says code that contradicts the spec is a bug in one of the two: flag it, do not silently reconcile. This file is that flag.

## Context

Spec §15.1 is an instrument: five colours, `--radius: 2px`, no gradients, glass, or card shadows, amber only on the pump total, and the pump count-up as the only motion. [ADR 0003](0003-cinematic-ui-override.md) overrode that for a cinematic pass (glass, ambient gradients, infinite glow, blur-based route transitions).

A follow-up product request kept Motion.dev but required the original visual restraint and a calm, utilitarian motion language: physical continuity, not flying chrome.

## Decision

**Visuals:** restore §15 restraint on surfaces we touch. No glass, backdrop-blur, card shadows, body gradients, or infinite decorative animation. `--mist` and `--night` remain as muted text and overlay dim only. Amber (`--gauge`) stays on the pump total.

**Motion:** override §15.1's "only motion" clause. Interaction motion is allowed for navigation, tabs, overlays, pickers, estimate loading, and first-reveal metric groups. It must use transform and opacity (accordion height is the measured-height exception). Pump count-up remains the signature numeral motion (~600 ms, announce once).

Presets live in `@brim/ui-kit` (`duration.feedback` 140 ms, `control` 180 ms, `panel` 240 ms, `route` 180 ms, weighted ease-out). Reduced motion snaps movement away and may keep a brief opacity change. State is never communicated by motion alone.

`LazyMotion` uses `domAnimation` (transform and opacity). Layout/drag (`domMax`) missed the §16 budget by a wide margin, so tab and nav indicators glide with `x` + `scaleX` instead of `layoutId`.

## Consequences

The kitchen sink (`/kitchen-sink`) is the motion lab, not a cinematic mood board. Re-run `npm run size` after UI changes: §16 still budgets initial JS under 150 kB gzip.

**Index:** [ADR list](README.md)
