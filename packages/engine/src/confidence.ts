import type { ConsumptionTier } from "@brim/shared";

const TIER_HALF_WIDTH: Record<ConsumptionTier, number> = {
  0: 0.04,
  1: 0.08,
  2: 0.1,
  3: 0.2,
  4: 0.25,
};

export function bandWidth(tier: ConsumptionTier, fallbacks: number): number {
  return TIER_HALF_WIDTH[tier] + fallbacks * 0.03;
}

export function applyBand(point: number, halfWidth: number): { point: number; low: number; high: number } {
  return {
    point,
    low: point * (1 - halfWidth),
    high: point * (1 + halfWidth),
  };
}
