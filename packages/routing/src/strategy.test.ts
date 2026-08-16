import { describe, expect, it } from "vitest";
import { MemoryCache, cachedRoute } from "./cache.js";
import { FixtureProvider, UK_FIXTURE_ROUTES } from "./providers/fixture.js";
import { GoogleRoutesProvider, GOOGLE_FIELD_MASKS } from "./providers/google.js";
import { selectRouteStrategy } from "./strategy.js";
import { budgetStatus } from "./budget.js";

describe("fixture provider", () => {
  it("covers six UK journeys and the interface", async () => {
    expect(UK_FIXTURE_ROUTES).toHaveLength(6);
    const p = new FixtureProvider();
    const r = await p.computeRoute({ origin: "Edinburgh", destination: "Glasgow", mode: "basic" });
    expect(r.distanceMeters).toBeGreaterThan(0);
    expect(p.capabilities.alternatives).toBe(false);
  });
});

describe("strategy", () => {
  it("never selects advanced for a profiled vehicle", () => {
    const choice = selectRouteStrategy({ hasVehicleProfile: true });
    expect(choice.mode).toBe("basic");
    expect(choice.branch).toBe("profiled-basic");
  });
});

describe("cache", () => {
  it("makes exactly one compute on a repeated key", async () => {
    const store = new MemoryCache();
    let calls = 0;
    const run = () =>
      cachedRoute(store, "k", 3600, async () => {
        calls += 1;
        return { n: calls };
      });
    await run();
    await run();
    expect(calls).toBe(1);
  });
});

describe("budget", () => {
  it("marks ceiling breach", () => {
    expect(budgetStatus({ spentUsd: 10, ceilingUsd: 10 }).exceeded).toBe(true);
    expect(budgetStatus({ spentUsd: 6, ceilingUsd: 10 }).alert).toBe("60");
  });
});

describe("provider selection", () => {
  it("keeps a profiled vehicle on basic even when Google is available", async () => {
    const { chooseProvider } = await import("./select.js");
    const choice = chooseProvider({
      fixtureMode: false,
      googleKey: "key",
      spentUsd: 0,
      ceilingUsd: 50,
      hasVehicleProfile: true,
    });
    expect(choice.mode).toBe("basic");
    expect(choice.provider.name).toBe("google");
  });
});

describe("google adapter", () => {
  it("uses a minimal field mask and fixtures only", async () => {
    expect(GOOGLE_FIELD_MASKS.basic.includes("distanceMeters")).toBe(true);
    expect(GOOGLE_FIELD_MASKS.basic.includes("fuelConsumption")).toBe(false);
    const provider = new GoogleRoutesProvider("test", async () =>
      new Response(
        JSON.stringify({
          routes: [
            {
              distanceMeters: 1000,
              duration: "60s",
              polyline: { encodedPolyline: "abc" },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const r = await provider.computeRoute({ origin: "A", destination: "B", mode: "basic" });
    expect(r.distanceMeters).toBe(1000);
  });
});
