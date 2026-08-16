import { z } from 'zod';
import { calibrateFromFillUps } from '@brim/engine';
import type { Context } from 'hono';
import type { ApiBindings } from './env.js';
import { ownerFromContext } from './session.js';
import { createDb } from './db/client.js';
import type { FillUpRow } from './db/memory.js';
import {
  deleteFillUp,
  getCalibration,
  getFillUp,
  getVehicle,
  listFillUps,
  saveCalibration,
  saveFillUp,
  type BrimDb,
} from './db/repo.js';

const fillUpBody = z.object({
  vehicleId: z.string().min(1),
  odometerMiles: z.number().positive(),
  quantity: z.number().positive(),
  unit: z.enum(['litres', 'kwh']),
  price: z.number().nonnegative(),
  brim: z.boolean(),
  occurredAt: z.string().optional(),
  note: z.string().max(280).optional(),
});

function publicFillUp(row: FillUpRow) {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    odometerMiles: row.odometer_miles,
    quantity: row.quantity,
    unit: row.unit,
    pricePence: row.price_pence,
    brim: row.filled_to_brim,
    occurredAt: row.occurred_at,
    note: row.note,
  };
}

export async function recomputeCalibration(
  db: BrimDb,
  ownerId: string,
  vehicleId: string,
  nowIso: string,
) {
  const vehicle = await getVehicle(db, ownerId, vehicleId);
  if (!vehicle) return undefined;
  const fills = await listFillUps(db, ownerId, vehicleId);
  const kind = vehicle.propulsion === 'bev' ? 'electric' : 'liquid';
  const computed = calibrateFromFillUps(
    fills.map((f) => ({
      odometerMiles: f.odometer_miles,
      quantity: f.quantity,
      unit: f.unit,
      filledToBrim: f.filled_to_brim,
      occurredAt: f.occurred_at,
    })),
    kind,
  );
  if (!computed) {
    await saveCalibration(db, ownerId, {
      id: crypto.randomUUID(),
      vehicle_id: vehicleId,
      calculated_value: 0,
      unit: kind === 'electric' ? 'kWh/100km' : 'l/100km',
      sample_count: 0,
      last_computed_at: nowIso,
    });
    return undefined;
  }
  return saveCalibration(db, ownerId, {
    id: crypto.randomUUID(),
    vehicle_id: vehicleId,
    calculated_value: computed.value,
    unit: computed.unit,
    sample_count: computed.sampleCount,
    last_computed_at: nowIso,
    ...(computed.stddev !== undefined ? { stddev: computed.stddev } : {}),
  });
}

function confidence(sampleCount: number): 'calibrated' | 'building' | 'none' {
  if (sampleCount >= 3) return 'calibrated';
  if (sampleCount > 0) return 'building';
  return 'none';
}

export async function createFillUpHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await ownerFromContext(c);
  const parsed = fillUpBody.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
  const db = createDb(c.env);
  const vehicle = await getVehicle(db, session.ownerId, parsed.data.vehicleId);
  if (!vehicle) return c.json({ error: 'not_found' }, 404);
  const wantUnit = vehicle.propulsion === 'bev' ? 'kwh' : 'litres';
  if (parsed.data.unit !== wantUnit) return c.json({ error: 'unit_mismatch' }, 400);
  const existing = await listFillUps(db, session.ownerId, vehicle.id);
  const latestMiles = existing.reduce((max, f) => Math.max(max, f.odometer_miles), 0);
  if (existing.length > 0 && parsed.data.odometerMiles <= latestMiles) {
    return c.json({ error: 'odometer_rollback' }, 400);
  }
  const row: FillUpRow = {
    id: crypto.randomUUID(),
    vehicle_id: parsed.data.vehicleId,
    odometer_miles: parsed.data.odometerMiles,
    quantity: parsed.data.quantity,
    unit: parsed.data.unit,
    price_pence: Math.round(parsed.data.price),
    filled_to_brim: parsed.data.brim,
    occurred_at: parsed.data.occurredAt ?? new Date().toISOString(),
  };
  if (parsed.data.note) row.note = parsed.data.note;
  const saved = await saveFillUp(db, session.ownerId, row);
  if (!saved) return c.json({ error: 'not_found' }, 404);
  await recomputeCalibration(db, session.ownerId, saved.vehicle_id, saved.occurred_at);
  return c.json(publicFillUp(saved), 201);
}

export async function listFillUpsHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await ownerFromContext(c);
  const vehicleId = c.req.param('id') ?? '';
  const db = createDb(c.env);
  if (!(await getVehicle(db, session.ownerId, vehicleId))) return c.json({ error: 'not_found' }, 404);
  const rows = await listFillUps(db, session.ownerId, vehicleId);
  return c.json({ fillUps: rows.map(publicFillUp) });
}

export async function deleteFillUpHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await ownerFromContext(c);
  const db = createDb(c.env);
  const existing = await getFillUp(db, session.ownerId, c.req.param('id') ?? '');
  if (!existing) return c.json({ error: 'not_found' }, 404);
  await deleteFillUp(db, session.ownerId, existing.id);
  await recomputeCalibration(db, session.ownerId, existing.vehicle_id, new Date().toISOString());
  return c.json({ ok: true });
}

export async function getCalibrationHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await ownerFromContext(c);
  const db = createDb(c.env);
  const vehicleId = c.req.param('id') ?? '';
  if (!(await getVehicle(db, session.ownerId, vehicleId))) return c.json({ error: 'not_found' }, 404);
  const row = await getCalibration(db, session.ownerId, vehicleId);
  const sampleCount = row?.sample_count ?? 0;
  return c.json({
    value: sampleCount > 0 ? row?.calculated_value : undefined,
    unit: row?.unit,
    sampleCount,
    stddev: row?.stddev,
    confidence: confidence(sampleCount),
  });
}
