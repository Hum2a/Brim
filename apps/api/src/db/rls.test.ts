import { describe, expect, it } from "vitest";
import { resetMemoryDb } from "./memory.js";
import { createDb } from "./client.js";
import { claimAnon, deleteVehicle, getVehicle, listVehicles, saveVehicle } from "./repo.js";

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
});
