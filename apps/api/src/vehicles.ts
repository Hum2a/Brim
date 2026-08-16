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
import { createDb } from './db/client.js';
import {
  deleteVehicle,
  getSettings,
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
  hasHeatPump: z.boolean().optional(),
});

const tariffBody = z.object({
  kind: z.enum(['home', 'public']).default('home'),
  pencePerKwh: z.number(),
  offpeakPence: z.number().optional(),
  offpeakWindow: z.string().optional(),
  network: z.string().optional(),
  isDefault: z.boolean().optional(),
});

type VehicleBody = z.infer<typeof vehicleBody>;
type VehicleFields = {
  nickname?: string | undefined;
  kind?: VehicleRow['kind'] | undefined;
  propulsion?: VehicleRow['propulsion'] | undefined;
  make?: string | undefined;
  model?: string | undefined;
  derivative?: string | undefined;
  transmission?: string | undefined;
  year?: number | undefined;
  engineCc?: number | undefined;
  co2Gkm?: number | undefined;
  tankLitres?: number | undefined;
  batteryKwhUsable?: number | undefined;
  euroStatus?: string | undefined;
  euroStatusSource?: 'dvla' | 'derived' | undefined;
  officialConsumption?: number | undefined;
  officialUnit?: VehicleBody['officialUnit'] | undefined;
  officialCycle?: VehicleBody['officialCycle'] | undefined;
  vcaMatchId?: string | undefined;
  hasHeatPump?: boolean | undefined;
};

function applyVehicleFields(row: VehicleRow, data: VehicleFields): VehicleRow {
  const next: VehicleRow = { ...row };
  if (data.nickname) next.nickname = data.nickname;
  if (data.kind) next.kind = data.kind;
  if (data.propulsion) next.propulsion = data.propulsion;
  if (data.make) next.make = data.make;
  if (data.model) next.model = data.model;
  if (data.derivative) next.derivative = data.derivative;
  if (data.transmission) next.transmission = data.transmission;
  if (data.year !== undefined) next.year = data.year;
  if (data.engineCc !== undefined) next.engine_cc = data.engineCc;
  if (data.co2Gkm !== undefined) next.co2_gkm = data.co2Gkm;
  if (data.tankLitres !== undefined) next.tank_litres = data.tankLitres;
  if (data.batteryKwhUsable !== undefined) next.battery_kwh_usable = data.batteryKwhUsable;
  if (data.euroStatus) next.euro_status = data.euroStatus;
  if (data.euroStatusSource) next.euro_status_source = data.euroStatusSource;
  if (data.officialConsumption !== undefined) next.official_consumption = data.officialConsumption;
  if (data.officialUnit) next.official_unit = data.officialUnit;
  if (data.officialCycle) next.official_cycle = data.officialCycle;
  if (data.vcaMatchId) next.vca_match_id = data.vcaMatchId;
  if (data.hasHeatPump !== undefined) next.has_heat_pump = data.hasHeatPump;
  return next;
}

async function owner(c: Context<{ Bindings: ApiBindings }>) {
  return ownerFromContext(c);
}

export async function listVehiclesHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await owner(c);
  const db = createDb(c.env);
  const settings = await getSettings(db, session.ownerId);
  const vehicles = await listVehicles(db, session.ownerId);
  return c.json({
    vehicles: vehicles.map((v) => ({
      ...v,
      is_default: settings?.default_vehicle_id === v.id,
    })),
  });
}

export async function createVehicleHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await owner(c);
  const parsed = vehicleBody.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
  const row = applyVehicleFields(
    {
      id: crypto.randomUUID(),
      owner_id: session.ownerId,
      kind: parsed.data.kind,
      propulsion: parsed.data.propulsion,
      created_at: new Date().toISOString(),
    },
    parsed.data,
  );
  return c.json(await saveVehicle(createDb(c.env), row), 201);
}

export async function patchVehicleHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await owner(c);
  const db = createDb(c.env);
  const existing = await getVehicle(db, session.ownerId, c.req.param('id') ?? '');
  if (!existing) return c.json({ error: 'not_found' }, 404);
  const parsed = vehicleBody.partial().safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
  return c.json(await saveVehicle(db, applyVehicleFields(existing, parsed.data)));
}

export async function deleteVehicleHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await owner(c);
  if (!(await deleteVehicle(createDb(c.env), session.ownerId, c.req.param('id') ?? '')))
    return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true });
}

export async function listTariffsHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await owner(c);
  return c.json({
    tariffs: await listTariffs(createDb(c.env), session.ownerId, c.req.param('id') ?? ''),
  });
}

export async function createTariffHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await owner(c);
  const parsed = tariffBody.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
  const row = await saveTariff(createDb(c.env), session.ownerId, {
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
