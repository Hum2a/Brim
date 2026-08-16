import { describe, expect, it } from "vitest";
import { loadFixture } from "./index.js";

describe("loadFixture", () => {
  it("throws when BRIM_FIXTURES is not set", () => {
    expect(() => loadFixture("health", "0")).toThrow(/BRIM_FIXTURES=1/);
  });

  it("returns the health fixture when enabled", () => {
    const health = loadFixture<{ fixtureMode: boolean }>("health", "1");
    expect(health.fixtureMode).toBe(true);
  });

  it("returns the VCA catalogue subset when enabled", () => {
    const cars = loadFixture<Array<{ make: string; fuel: string }>>("vca-vehicles", "1");
    expect(cars.length).toBeGreaterThanOrEqual(20);
    expect(new Set(cars.map((c) => c.fuel)).size).toBeGreaterThanOrEqual(4);
  });

  it("returns carbon intensity half-hours when enabled", () => {
    const rows = loadFixture<Array<{ region: string; intensityGPerKwh: number }>>(
      "carbon-intensity",
      "1",
    );
    expect(rows.some((r) => r.region === "GB" && r.intensityGPerKwh === 190)).toBe(true);
  });
});
