import { z } from 'zod';
import {
  consumptionUnitSchema,
  propulsionSchema,
  testCycleSchema,
  vehicleKindSchema,
} from '@brim/shared';
import type { Context } from 'hono';
import type { ApiBindings } from './env.js';
import { ownerFromContext } from './session.js';
import {
  deleteVehicle,
  getVehicle,
  listTariffs,
  listVehicles,
  saveTariff,
  saveVehicle,
} from './db/repo.js';
import type { VehicleRow } from './db/memory.js';

const vehicleBody = z.object({
  nickname: z.string().optional(),
  kind: vehicleKindSchema.default('car'),
  propulsion: propulsionSchema,
  make: z.string().optional(),
  model: z.string().optional(),
  derivative: z.string().optional(),
  transmission: z.string().optional(),
  year: z.number().int().optional(),
  engineCc: z.number().int().optional(),
  co2Gkm: z.number().int().optional(),
  tankLitres: z.number().optional(),
  batteryKwhUsable: z.number().optional(),
  euroStatus: z.string().optional(),
  euroStatusSource: z.enum(['dvla', 'derived']).optional(),
  officialConsumption: z.number().optional(),
  officialUnit: consumptionUnitSchema.optional(),
  officialCycle: testCycleSchema.optional(),
  vcaMatchId: z.string().optional(),
});

const tariffBody = z.object({
  kind: z.enum(['home', 'public']).default('home'),
  pencePerKwh: z.number(),
  offpeakPence: z.number().optional(),
  offpeakWindow: z.string().optional(),
  network: z.string().optional(),
  isDefault: z.boolean().optional(),
});

async function owner(c: Context<{ Bindings: ApiBindings }>) {
  return ownerFromContext(c);
}

export async function listVehiclesHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await owner(c);
  return c.json({ vehicles: listVehicles(session.ownerId) });
}

export async function createVehicleHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await owner(c);
  const parsed = vehicleBody.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
  const row: VehicleRow = {
    id: crypto.randomUUID(),
    owner_id: session.ownerId,
    kind: parsed.data.kind,
    propulsion: parsed.data.propulsion,
    created_at: new Date().toISOString(),
  };
  if (parsed.data.nickname) row.nickname = parsed.data.nickname;
  if (parsed.data.make) row.make = parsed.data.make;
  if (parsed.data.model) row.model = parsed.data.model;
  if (parsed.data.derivative) row.derivative = parsed.data.derivative;
  if (parsed.data.transmission) row.transmission = parsed.data.transmission;
  if (parsed.data.year !== undefined) row.year = parsed.data.year;
  if (parsed.data.engineCc !== undefined) row.engine_cc = parsed.data.engineCc;
  if (parsed.data.co2Gkm !== undefined) row.co2_gkm = parsed.data.co2Gkm;
  if (parsed.data.tankLitres !== undefined) row.tank_litres = parsed.data.tankLitres;
  if (parsed.data.batteryKwhUsable !== undefined)
    row.battery_kwh_usable = parsed.data.batteryKwhUsable;
  if (parsed.data.euroStatus) row.euro_status = parsed.data.euroStatus;
  if (parsed.data.euroStatusSource) row.euro_status_source = parsed.data.euroStatusSource;
  if (parsed.data.officialConsumption !== undefined)
    row.official_consumption = parsed.data.officialConsumption;
  if (parsed.data.officialUnit) row.official_unit = parsed.data.officialUnit;
  if (parsed.data.officialCycle) row.official_cycle = parsed.data.officialCycle;
  if (parsed.data.vcaMatchId) row.vca_match_id = parsed.data.vcaMatchId;
  return c.json(saveVehicle(row), 201);
}

export async function patchVehicleHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await owner(c);
  const existing = getVehicle(session.ownerId, c.req.param('id') ?? '');
  if (!existing) return c.json({ error: 'not_found' }, 404);
  const parsed = vehicleBody.partial().safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
  const next = { ...existing };
  if (parsed.data.nickname) next.nickname = parsed.data.nickname;
  if (parsed.data.propulsion) next.propulsion = parsed.data.propulsion;
  if (parsed.data.kind) next.kind = parsed.data.kind;
  return c.json(saveVehicle(next));
}

export async function deleteVehicleHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await owner(c);
  if (!deleteVehicle(session.ownerId, c.req.param('id') ?? ''))
    return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true });
}

export async function listTariffsHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await owner(c);
  return c.json({ tariffs: listTariffs(session.ownerId, c.req.param('id') ?? '') });
}

export async function createTariffHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await owner(c);
  const parsed = tariffBody.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
  const row = saveTariff(session.ownerId, {
    id: crypto.randomUUID(),
    vehicle_id: c.req.param('id') ?? '',
    kind: parsed.data.kind,
    pence_per_kwh: parsed.data.pencePerKwh,
    is_default: parsed.data.isDefault ?? true,
    ...(parsed.data.offpeakPence !== undefined ? { offpeak_pence: parsed.data.offpeakPence } : {}),
    ...(parsed.data.offpeakWindow ? { offpeak_window: parsed.data.offpeakWindow } : {}),
    ...(parsed.data.network ? { network: parsed.data.network } : {}),
  });
  if (!row) return c.json({ error: 'not_found' }, 404);
  return c.json(row, 201);
}
