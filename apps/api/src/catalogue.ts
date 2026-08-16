import { eq, ilike, or } from "drizzle-orm";
import {
  CATALOGUE_LIMIT,
  MIN_QUERY,
  consumptionUnitSchema,
  getVcaById,
  isFixtureMode,
  loadFixture,
  propulsionSchema,
  searchVcaCatalogue,
  testCycleSchema,
  vcaToCatalogue,
  type VcaVehicle,
} from "@brim/shared";
import type { Context } from "hono";
import type { ApiBindings } from "./env.js";
import { createDb } from "./db/client.js";
import { vcaVehicles } from "./db/schema.js";

function fixtureVehicles(flag: string | undefined): VcaVehicle[] {
  return loadFixture<VcaVehicle[]>("vca-vehicles", flag);
}

function rowToVca(row: typeof vcaVehicles.$inferSelect): VcaVehicle | undefined {
  const fuel = propulsionSchema.safeParse(row.fuel);
  const unit = consumptionUnitSchema.safeParse(row.unit);
  const cycle = testCycleSchema.safeParse(row.cycle);
  if (!fuel.success || !unit.success || !cycle.success) return undefined;
  if (row.consumptionCombined === null) return undefined;
  const vehicle: VcaVehicle = {
    id: row.id,
    make: row.make,
    model: row.model,
    fuel: fuel.data,
    consumptionCombined: row.consumptionCombined,
    unit: unit.data,
    cycle: cycle.data,
    datasetVersion: row.datasetVersion ?? "",
  };
  if (row.derivative) vehicle.derivative = row.derivative;
  if (row.transmission) vehicle.transmission = row.transmission;
  if (row.engineCc !== null && row.engineCc !== undefined) vehicle.engineCc = row.engineCc;
  if (row.co2Gkm !== null && row.co2Gkm !== undefined) vehicle.co2Gkm = row.co2Gkm;
  return vehicle;
}

export async function listCatalogueHandler(c: Context<{ Bindings: ApiBindings }>) {
  const q = c.req.query("q") ?? "";
  if (isFixtureMode(c.env.BRIM_FIXTURES)) {
    return c.json({ vehicles: searchVcaCatalogue(fixtureVehicles(c.env.BRIM_FIXTURES), q) });
  }
  const needle = q.replace(/[%_]/g, "").trim();
  if (needle.length < MIN_QUERY) return c.json({ vehicles: [] });
  const db = createDb(c.env);
  if (!db.drizzle) return c.json({ vehicles: [] });
  const pattern = `%${needle}%`;
  const rows = await db.drizzle
    .select()
    .from(vcaVehicles)
    .where(
      or(ilike(vcaVehicles.make, pattern), ilike(vcaVehicles.model, pattern), ilike(vcaVehicles.derivative, pattern)),
    )
    .limit(80);
  const vehicles = rows.flatMap((row) => {
    const mapped = rowToVca(row);
    return mapped ? [mapped] : [];
  });
  return c.json({ vehicles: searchVcaCatalogue(vehicles, q, CATALOGUE_LIMIT) });
}

export async function getCatalogueHandler(c: Context<{ Bindings: ApiBindings }>) {
  const id = c.req.param("id") ?? "";
  if (isFixtureMode(c.env.BRIM_FIXTURES)) {
    const hit = getVcaById(fixtureVehicles(c.env.BRIM_FIXTURES), id);
    if (!hit) return c.json({ error: "not_found" }, 404);
    return c.json(hit);
  }
  const db = createDb(c.env);
  if (!db.drizzle) return c.json({ error: "not_found" }, 404);
  const rows = await db.drizzle.select().from(vcaVehicles).where(eq(vcaVehicles.id, id)).limit(1);
  const mapped = rows[0] ? rowToVca(rows[0]) : undefined;
  if (!mapped) return c.json({ error: "not_found" }, 404);
  return c.json(vcaToCatalogue(mapped));
}
