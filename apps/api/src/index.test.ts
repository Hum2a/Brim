import { describe, expect, it } from "vitest";
import app from "./index.js";

describe("api", () => {
  it("serves /health in fixture mode", async () => {
    const res = await app.request("/health", {}, { BRIM_FIXTURES: "1" });
    const json = (await res.json()) as { status: string; fixtureMode: boolean };
    expect(json.status).toBe("ok");
    expect(json.fixtureMode).toBe(true);
  });

  it("estimates a fixture journey", async () => {
    const res = await app.request(
      "/v1/estimate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: "Crawley",
          destination: "London",
          propulsion: "petrol",
          vehicleInline: { kind: "car", propulsion: "petrol", userEnteredConsumption: 40, userEnteredUnit: "mpg" },
        }),
      },
      { BRIM_FIXTURES: "1" },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { cost: { totalPence: { point: number } }; consumption: { label: string } };
    expect(json.cost.totalPence.point).toBeGreaterThan(0);
    expect(json.consumption.label.length).toBeGreaterThan(0);
  });
});
