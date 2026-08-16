import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { computeEstimate, type EstimateInput } from "./index.js";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../testdata/golden");

const scenarios: Array<{ name: string; input: EstimateInput }> = [
  {
    name: "petrol-calibrated",
    input: {
      distanceMeters: 160934,
      durationSeconds: 7200,
      propulsion: "petrol",
      calibration: { value: 6.2, unit: "l/100km", sampleCount: 4 },
      pricePence: 139.9,
      priceUnit: "ppl",
      priceSource: "national-median",
      priceObservedAt: "2026-01-15T12:00:00Z",
    },
  },
  {
    name: "petrol-official",
    input: {
      distanceMeters: 160934,
      propulsion: "petrol",
      official: { value: 5.5, unit: "l/100km", cycle: "WLTP" },
      pricePence: 139.9,
      priceUnit: "ppl",
      priceSource: "national-median",
      priceObservedAt: "2026-01-15T12:00:00Z",
    },
  },
  {
    name: "petrol-unknown",
    input: {
      distanceMeters: 160934,
      propulsion: "petrol",
      pricePence: 139.9,
      priceUnit: "ppl",
      priceSource: "hardcoded-fallback",
      priceObservedAt: "2026-01-15T12:00:00Z",
    },
  },
  {
    name: "diesel-calibrated",
    input: {
      distanceMeters: 200000,
      propulsion: "diesel",
      calibration: { value: 5.1, unit: "l/100km", sampleCount: 6 },
      pricePence: 145,
      priceUnit: "ppl",
      priceSource: "home-area-median",
      priceObservedAt: "2026-01-15T12:00:00Z",
    },
  },
  {
    name: "diesel-official",
    input: {
      distanceMeters: 200000,
      propulsion: "diesel",
      official: { value: 4.8, unit: "l/100km", cycle: "NEDC" },
      pricePence: 145,
      priceUnit: "ppl",
      priceSource: "national-median",
      priceObservedAt: "2026-01-15T12:00:00Z",
    },
  },
  {
    name: "diesel-unknown",
    input: {
      distanceMeters: 200000,
      propulsion: "diesel",
      pricePence: 145,
      priceUnit: "ppl",
      priceSource: "hardcoded-fallback",
      priceObservedAt: "2026-01-15T12:00:00Z",
    },
  },
  {
    name: "bev-calibrated",
    input: {
      distanceMeters: 160934,
      propulsion: "bev",
      calibration: { value: 16, unit: "kWh/100km", sampleCount: 5 },
      vehicle: { kind: "car", propulsion: "bev", batteryKwhUsable: 64, startChargePercent: 90 },
      pricePence: 7.5,
      priceUnit: "p/kWh",
      priceSource: "user-tariff",
      priceObservedAt: "2026-01-15T12:00:00Z",
      forecastTempC: 12,
      gridIntensityGPerKwh: 120,
    },
  },
  {
    name: "bev-official",
    input: {
      distanceMeters: 160934,
      propulsion: "bev",
      official: { value: 15, unit: "kWh/100km", cycle: "WLTP" },
      vehicle: { kind: "car", propulsion: "bev", batteryKwhUsable: 50, startChargePercent: 80, hasHeatPump: true },
      pricePence: 7.5,
      priceUnit: "p/kWh",
      priceSource: "user-tariff",
      priceObservedAt: "2026-01-15T12:00:00Z",
      forecastTempC: 2,
      gridIntensityGPerKwh: 120,
    },
  },
  {
    name: "bev-unknown",
    input: {
      distanceMeters: 160934,
      propulsion: "bev",
      pricePence: 28,
      priceUnit: "p/kWh",
      priceSource: "hardcoded-fallback",
      priceObservedAt: "2026-01-15T12:00:00Z",
    },
  },
  {
    name: "phev-calibrated",
    input: {
      distanceMeters: 80000,
      propulsion: "phev",
      calibration: { value: 3.2, unit: "l/100km", sampleCount: 4 },
      vehicle: { kind: "car", propulsion: "phev", batteryKwhUsable: 14, startChargePercent: 100 },
      pricePence: 7.5,
      priceUnit: "p/kWh",
      priceSource: "user-tariff",
      priceObservedAt: "2026-01-15T12:00:00Z",
    },
  },
  {
    name: "phev-official",
    input: {
      distanceMeters: 80000,
      propulsion: "phev",
      official: { value: 18, unit: "kWh/100km", cycle: "WLTP" },
      vehicle: { kind: "car", propulsion: "phev", batteryKwhUsable: 14, startChargePercent: 40 },
      pricePence: 7.5,
      priceUnit: "p/kWh",
      priceSource: "user-tariff",
      priceObservedAt: "2026-01-15T12:00:00Z",
    },
  },
  {
    name: "phev-unknown",
    input: {
      distanceMeters: 80000,
      propulsion: "phev",
      pricePence: 140,
      priceUnit: "ppl",
      priceSource: "hardcoded-fallback",
      priceObservedAt: "2026-01-15T12:00:00Z",
    },
  },
];

describe("golden estimates", () => {
  it("has 12 scenarios", () => {
    expect(scenarios).toHaveLength(12);
  });

  for (const s of scenarios) {
    it(s.name, () => {
      const actual = computeEstimate(s.input);
      const path = join(dir, `${s.name}.json`);
      mkdirSync(dir, { recursive: true });
      let expected: unknown;
      try {
        expected = JSON.parse(readFileSync(path, "utf8")) as unknown;
      } catch {
        writeFileSync(path, `${JSON.stringify(actual, null, 2)}\n`);
        expected = actual;
      }
      expect(JSON.parse(JSON.stringify(actual))).toEqual(expected);
    });
  }
});
