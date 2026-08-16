import { describe, expect, it } from "vitest";
import { getVcaById, searchVcaCatalogue } from "./search.js";
import type { VcaVehicle } from "./types.js";

const sample: VcaVehicle[] = [
  {
    id: "vca_focus",
    make: "Ford",
    model: "Focus",
    derivative: "1.0 EcoBoost 125 Titanium",
    fuel: "petrol",
    consumptionCombined: 51.4,
    unit: "mpg",
    cycle: "WLTP",
    datasetVersion: "fixture",
  },
  {
    id: "vca_fiesta",
    make: "Ford",
    model: "Fiesta",
    derivative: "1.0 EcoBoost ST-Line",
    fuel: "petrol",
    consumptionCombined: 55.4,
    unit: "mpg",
    cycle: "WLTP",
    datasetVersion: "fixture",
  },
  {
    id: "vca_leaf",
    make: "Nissan",
    model: "Leaf",
    fuel: "bev",
    consumptionCombined: 3.6,
    unit: "mi/kWh",
    cycle: "WLTP",
    datasetVersion: "fixture",
  },
];

describe("searchVcaCatalogue", () => {
  it("returns nothing for a short or empty query", () => {
    expect(searchVcaCatalogue(sample, "")).toEqual([]);
    expect(searchVcaCatalogue(sample, "F")).toEqual([]);
  });

  it("ranks make prefix ahead of a later substring", () => {
    const hits = searchVcaCatalogue(sample, "ford");
    expect(hits.map((h) => h.model)).toEqual(["Fiesta", "Focus"]);
  });

  it("finds a model substring", () => {
    const hits = searchVcaCatalogue(sample, "leaf");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.propulsion).toBe("bev");
    expect(hits[0]?.officialConsumption).toBe(3.6);
  });

  it("looks up by id", () => {
    expect(getVcaById(sample, "vca_focus")?.make).toBe("Ford");
    expect(getVcaById(sample, "missing")).toBeUndefined();
  });
});
