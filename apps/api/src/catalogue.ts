import { and, eq, ilike, or, sql } from 'drizzle-orm';
import {
  CATALOGUE_LIMIT,
  CATALOGUE_TRIM_LIMIT,
  MIN_QUERY,
  consumptionUnitSchema,
  getVcaById,
  isFixtureMode,
  listVcaMakes,
  listVcaModels,
  listVcaTrims,
  loadFixture,
  propulsionSchema,
  searchVcaCatalogue,
  sortVcaMakes,
  testCycleSchema,
  vcaToCatalogue,
  type VcaVehicle,
} from '@brim/shared';
import type { Context } from 'hono';
import type { ApiBindings } from './env.js';
import { createDb } from './db/client.js';
import { vcaVehicles } from './db/schema.js';

function fixtureVehicles(flag: string | undefined): VcaVehicle[] {
  return loadFixture<VcaVehicle[]>('vca-vehicles', flag);
}

export function rowToVca(row: typeof vcaVehicles.$inferSelect): VcaVehicle | undefined {
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
    datasetVersion: row.datasetVersion ?? '',
  };
  if (row.derivative) vehicle.derivative = row.derivative;
  if (row.transmission) vehicle.transmission = row.transmission;
  if (row.engineCc !== null && row.engineCc !== undefined) vehicle.engineCc = row.engineCc;
  if (row.co2Gkm !== null && row.co2Gkm !== undefined) vehicle.co2Gkm = row.co2Gkm;
  return vehicle;
}

function facetName(value: string | null | undefined): string | undefined {
  const name = value?.trim();
  return name ? name : undefined;
}

export async function listMakesHandler(c: Context<{ Bindings: ApiBindings }>) {
  if (isFixtureMode(c.env.BRIM_FIXTURES)) {
    return c.json({ makes: listVcaMakes(fixtureVehicles(c.env.BRIM_FIXTURES)) });
  }
  const db = createDb(c.env);
  if (!db.drizzle) return c.json({ makes: [] });
  const rows = await db.drizzle
    .select({ name: vcaVehicles.make, n: sql<number>`count(*)::int` })
    .from(vcaVehicles)
    .groupBy(vcaVehicles.make);
  return c.json({
    makes: sortVcaMakes(
      rows.flatMap((row) => (row.name ? [{ name: row.name, count: Number(row.n) }] : [])),
    ),
  });
}

export async function listModelsHandler(c: Context<{ Bindings: ApiBindings }>) {
  const make = facetName(c.req.query('make'));
  if (!make) return c.json({ models: [] });
  if (isFixtureMode(c.env.BRIM_FIXTURES)) {
    return c.json({ models: listVcaModels(fixtureVehicles(c.env.BRIM_FIXTURES), make) });
  }
  const db = createDb(c.env);
  if (!db.drizzle) return c.json({ models: [] });
  const rows = await db.drizzle
    .select({ name: vcaVehicles.model, n: sql<number>`count(*)::int` })
    .from(vcaVehicles)
    .where(eq(vcaVehicles.make, make))
    .groupBy(vcaVehicles.model);
  return c.json({
    models: rows
      .flatMap((row) => (row.name ? [{ name: row.name, count: Number(row.n) }] : []))
      .sort((a, b) => a.name.localeCompare(b.name)),
  });
}

export async function listCatalogueHandler(c: Context<{ Bindings: ApiBindings }>) {
  const q = c.req.query('q') ?? '';
  const make = facetName(c.req.query('make'));
  const model = facetName(c.req.query('model'));

  if (make && model) {
    if (isFixtureMode(c.env.BRIM_FIXTURES)) {
      return c.json({ vehicles: listVcaTrims(fixtureVehicles(c.env.BRIM_FIXTURES), make, model) });
    }
    const db = createDb(c.env);
    if (!db.drizzle) return c.json({ vehicles: [] });
    const rows = await db.drizzle
      .select()
      .from(vcaVehicles)
      .where(and(eq(vcaVehicles.make, make), eq(vcaVehicles.model, model)))
      .limit(CATALOGUE_TRIM_LIMIT);
    const vehicles = rows.flatMap((row) => {
      const mapped = rowToVca(row);
      return mapped ? [vcaToCatalogue(mapped)] : [];
    });
    vehicles.sort(
      (a, b) =>
        (a.derivative ?? '').localeCompare(b.derivative ?? '') ||
        (a.transmission ?? '').localeCompare(b.transmission ?? '') ||
        a.propulsion.localeCompare(b.propulsion),
    );
    return c.json({ vehicles });
  }

  if (isFixtureMode(c.env.BRIM_FIXTURES)) {
    return c.json({ vehicles: searchVcaCatalogue(fixtureVehicles(c.env.BRIM_FIXTURES), q) });
  }
  const needle = q.replace(/[%_]/g, '').trim();
  if (needle.length < MIN_QUERY) return c.json({ vehicles: [] });
  const db = createDb(c.env);
  if (!db.drizzle) return c.json({ vehicles: [] });
  const pattern = `%${needle}%`;
  const rows = await db.drizzle
    .select()
    .from(vcaVehicles)
    .where(
      or(
        ilike(vcaVehicles.make, pattern),
        ilike(vcaVehicles.model, pattern),
        ilike(vcaVehicles.derivative, pattern),
      ),
    )
    .limit(80);
  const vehicles = rows.flatMap((row) => {
    const mapped = rowToVca(row);
    return mapped ? [mapped] : [];
  });
  return c.json({ vehicles: searchVcaCatalogue(vehicles, q, CATALOGUE_LIMIT) });
}

export async function getCatalogueHandler(c: Context<{ Bindings: ApiBindings }>) {
  const id = c.req.param('id') ?? '';
  if (isFixtureMode(c.env.BRIM_FIXTURES)) {
    const hit = getVcaById(fixtureVehicles(c.env.BRIM_FIXTURES), id);
    if (!hit) return c.json({ error: 'not_found' }, 404);
    return c.json(hit);
  }
  const db = createDb(c.env);
  if (!db.drizzle) return c.json({ error: 'not_found' }, 404);
  const rows = await db.drizzle.select().from(vcaVehicles).where(eq(vcaVehicles.id, id)).limit(1);
  const mapped = rows[0] ? rowToVca(rows[0]) : undefined;
  if (!mapped) return c.json({ error: 'not_found' }, 404);
  return c.json(vcaToCatalogue(mapped));
}
