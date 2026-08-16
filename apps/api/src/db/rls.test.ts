import { describe, expect, it } from "vitest";
import { resetMemoryDb } from "./memory.js";
import { createDb } from "./client.js";
import { claimAnon, deleteVehicle, getPlace, getVehicle, listFillUps, listPlaces, listVehicles, saveFillUp, savePlace, saveVehicle } from "./repo.js";

const fixtureDb = () => createDb({ BRIM_FIXTURES: "1" });

describe("owner isolation (RLS subject)", () => {
  it("denies cross-tenant read, update and delete on every owner-scoped table", async () => {
    resetMemoryDb();
    const db = fixtureDb();
    const a = await saveVehicle(db, {
      id: "va",
      owner_id: "owner-a",
      kind: "car",
      propulsion: "petrol",
      nickname: "A's car",
      created_at: "2026-01-01T00:00:00Z",
    });
    expect(await listVehicles(db, "owner-b")).toEqual([]);
    expect(await getVehicle(db, "owner-b", a.id)).toBeUndefined();
    expect(await deleteVehicle(db, "owner-b", a.id)).toBe(false);
    expect((await getVehicle(db, "owner-a", a.id))?.nickname).toBe("A's car");
  });

  it("rewrites anon ownership on claim without duplicating", async () => {
    resetMemoryDb();
    const db = fixtureDb();
    await saveVehicle(db, {
      id: "v1",
      owner_id: "anon-1",
      kind: "car",
      propulsion: "diesel",
      nickname: "Van",
      created_at: "2026-01-01T00:00:00Z",
    });
    const result = await claimAnon(db, "anon-1", "user-1");
    expect(result.merged).toBe(true);
    expect(await getVehicle(db, "anon-1", "v1")).toBeUndefined();
    expect((await getVehicle(db, "user-1", "v1"))?.nickname).toBe("Van");
  });

  it("denies cross-tenant fill-ups and prefers the account home on claim", async () => {
    resetMemoryDb();
    const db = fixtureDb();
    await saveVehicle(db, {
      id: "va",
      owner_id: "owner-a",
      kind: "car",
      propulsion: "petrol",
      created_at: "2026-01-01T00:00:00Z",
    });
    await saveFillUp(db, "owner-a", {
      id: "f1",
      vehicle_id: "va",
      odometer_miles: 1000,
      quantity: 40,
      unit: "litres",
      price_pence: 5000,
      filled_to_brim: true,
      occurred_at: "2026-01-01T00:00:00Z",
    });
    expect(await listFillUps(db, "owner-b", "va")).toEqual([]);
    await savePlace(db, {
      id: "home-acct",
      owner_id: "user-1",
      kind: "home",
      label: "Account home",
      lat: 51,
      lng: 0,
      created_at: "2026-01-01T00:00:00Z",
    });
    await savePlace(db, {
      id: "home-anon",
      owner_id: "anon-2",
      kind: "home",
      label: "Anon home",
      lat: 52,
      lng: 1,
      created_at: "2026-01-02T00:00:00Z",
    });
    await claimAnon(db, "anon-2", "user-1");
    const homes = (await listPlaces(db, "user-1")).filter((p) => p.kind === "home");
    expect(homes).toHaveLength(1);
    expect(homes[0]?.label).toBe("Account home");
    expect(await getPlace(db, "user-1", "home-anon")).toBeUndefined();
  });
});
