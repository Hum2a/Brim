import { describe, expect, it } from "vitest";
import { VCA_VEHICLE_FIXTURES } from "../fixtures/vca-vehicles.js";
import {
  DVLA_FIXTURE_BEV,
  DVLA_FIXTURE_FEW,
  DVLA_FIXTURE_NONE,
  DVLA_FIXTURE_SINGLE,
  DVLA_VES_FIXTURES,
} from "../fixtures/dvla.js";
import { joinOutcome, joinVca } from "./join.js";
import { mapDvlaFuel, normaliseVrm } from "./normalise.js";
import { parseVesJson } from "./pull.js";
import type { VcaVehicle } from "../vca/types.js";

function vesFromFixture(plate: string) {
  const row = DVLA_VES_FIXTURES[plate];
  expect(row).toBeTruthy();
  const parsed = parseVesJson(row);
  if ("reason" in parsed) throw new Error(parsed.reason);
  return parsed;
}

describe("normaliseVrm", () => {
  it("accepts the current UK format and rejects the rest", () => {
    expect(normaliseVrm("ab12 cde")).toBe("AB12CDE");
    expect(normaliseVrm("AB12CDE")).toBe("AB12CDE");
    expect(normaliseVrm("NOPE")).toBeUndefined();
    expect(normaliseVrm("A1BCD")).toBeUndefined();
  });
});

describe("mapDvlaFuel", () => {
  it("does not treat hybrid electric as a BEV", () => {
    expect(mapDvlaFuel("PETROL")).toBe("petrol");
    expect(mapDvlaFuel("DIESEL")).toBe("diesel");
    expect(mapDvlaFuel("ELECTRICITY")).toBe("bev");
    expect(mapDvlaFuel("HYBRID ELECTRIC")).toBe("hybrid");
    expect(mapDvlaFuel("PETROL/ELECTRIC")).toBe("phev");
    expect(mapDvlaFuel("DIESEL/ELECTRIC")).toBe("phev");
    expect(mapDvlaFuel("STEAM")).toBeUndefined();
  });
});

describe("joinVca", () => {
  it("returns a unique Golf for the single fixture", () => {
    const hits = joinVca(vesFromFixture(DVLA_FIXTURE_SINGLE), VCA_VEHICLE_FIXTURES);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.id).toBe("vca_vw_golf_15_tsi");
    expect(joinOutcome(hits.length)).toBe("single");
  });

  it("lists Fiesta and Focus for the close Ford petrol", () => {
    const hits = joinVca(vesFromFixture(DVLA_FIXTURE_FEW), VCA_VEHICLE_FIXTURES);
    expect(hits.map((h) => h.id).sort()).toEqual([
      "vca_ford_fiesta_10_stline",
      "vca_ford_focus_10_titanium",
    ]);
    expect(joinOutcome(hits.length)).toBe("few");
  });

  it("returns none when nothing is in tolerance, and still parsed euro from VES", () => {
    const ves = vesFromFixture(DVLA_FIXTURE_NONE);
    expect(ves.euroStatus).toBe("EURO 5");
    expect(joinVca(ves, VCA_VEHICLE_FIXTURES)).toEqual([]);
    expect(joinOutcome(0)).toBe("none");
  });

  it("matches a BEV without engine capacity", () => {
    const hits = joinVca(vesFromFixture(DVLA_FIXTURE_BEV), VCA_VEHICLE_FIXTURES);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.id).toBe("vca_nissan_leaf");
  });

  it("treats more than six hits as none", () => {
    const clones: VcaVehicle[] = Array.from({ length: 7 }, (_, i) => ({
      id: `vca_flood_${i}`,
      make: "Flood",
      model: `Car ${i}`,
      fuel: "petrol",
      engineCc: 1000,
      co2Gkm: 120,
      consumptionCombined: 50,
      unit: "mpg",
      cycle: "WLTP",
      datasetVersion: "fixture",
    }));
    const hits = joinVca(
      { make: "Flood", propulsion: "petrol", engineCc: 1000, co2Gkm: 120 },
      clones,
    );
    expect(hits).toEqual([]);
    expect(joinOutcome(hits.length)).toBe("none");
  });
});

describe("parseVesJson", () => {
  it("never copies the registration number onto the vehicle", () => {
    const parsed = parseVesJson({
      registrationNumber: "AB12CDE",
      make: "FORD",
      fuelType: "PETROL",
      yearOfManufacture: 2020,
      engineCapacity: 999,
      co2Emissions: 115,
      euroStatus: "EURO 6",
    });
    expect(parsed).not.toHaveProperty("registrationNumber");
    expect(JSON.stringify(parsed)).not.toMatch(/AB12CDE/);
  });
});
