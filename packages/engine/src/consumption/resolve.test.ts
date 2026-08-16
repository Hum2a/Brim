import { describe, expect, it } from "vitest";
import { bandWidth } from "../confidence.js";
import { applyRoadShape } from "./roadShape.js";
import { resolveConsumption } from "./resolve.js";

describe("resolveConsumption tier chain", () => {
  it("selects tier 0 when calibration has ≥3 samples", () => {
    const r = resolveConsumption({
      kind: "liquid",
      calibration: { value: 6.5, unit: "l/100km", sampleCount: 3 },
      userEntered: { value: 40, unit: "mpg" },
      official: { value: 5, unit: "l/100km", cycle: "WLTP" },
    });
    expect(r.tier).toBe(0);
    expect(r.label).toBe("Based on your fill-ups");
    expect(r.value).toBe(6.5);
  });

  it("rejects calibration with fewer than 3 samples and falls through", () => {
    const r = resolveConsumption({
      kind: "liquid",
      calibration: { value: 6.5, unit: "l/100km", sampleCount: 2 },
      userEntered: { value: 7, unit: "l/100km" },
    });
    expect(r.tier).toBe(1);
    expect(r.reasons.some((s) => s.includes("at least 3"))).toBe(true);
  });

  it("selects tier 1 for user-entered", () => {
    const r = resolveConsumption({
      kind: "liquid",
      userEntered: { value: 40, unit: "mpg" },
      official: { value: 5, unit: "l/100km", cycle: "WLTP" },
    });
    expect(r.tier).toBe(1);
    expect(r.label).toBe("You told us");
  });

  it("selects tier 2 for official WLTP with 1.12 correction", () => {
    const r = resolveConsumption({
      kind: "liquid",
      official: { value: 5, unit: "l/100km", cycle: "WLTP" },
    });
    expect(r.tier).toBe(2);
    expect(r.value).toBeCloseTo(5.6, 6);
    expect(r.label).toBe("Official figure, adjusted");
  });

  it("selects tier 2 for official NEDC with 1.25 correction", () => {
    const r = resolveConsumption({
      kind: "liquid",
      official: { value: 8, unit: "l/100km", cycle: "NEDC" },
    });
    expect(r.value).toBeCloseTo(10, 6);
  });

  it("selects tier 2 for EV official with 1.15 correction", () => {
    const r = resolveConsumption({
      kind: "electric",
      official: { value: 16, unit: "kWh/100km", cycle: "WLTP" },
    });
    expect(r.value).toBeCloseTo(18.4, 6);
  });

  it("selects tier 3 for class average", () => {
    const r = resolveConsumption({
      kind: "liquid",
      classAverage: { value: 7.5, unit: "l/100km" },
    });
    expect(r.tier).toBe(3);
  });

  it("selects tier 4 for provider estimate", () => {
    const r = resolveConsumption({
      kind: "liquid",
      providerEstimate: { litres: 8, distanceKm: 100 },
    });
    expect(r.tier).toBe(4);
    expect(r.value).toBeCloseTo(8, 6);
  });

  it("falls back to class average when nothing else is provided", () => {
    const r = resolveConsumption({ kind: "liquid", propulsion: "petrol" });
    expect(r.tier).toBe(3);
    expect(r.value).toBeGreaterThan(0);
  });
});

describe("road shape and bands", () => {
  it("downgrades when composition is missing", () => {
    const resolved = resolveConsumption({
      kind: "liquid",
      userEntered: { value: 8, unit: "l/100km" },
    });
    const shaped = applyRoadShape(resolved, "liquid", undefined);
    expect(shaped.fallbacks).toBe(1);
    expect(shaped.value).toBe(resolved.value);
  });

  it("never narrows the band when a fallback is added", () => {
    const w0 = bandWidth(2, 0);
    const w1 = bandWidth(2, 1);
    expect(w1).toBeGreaterThan(w0);
  });
});
