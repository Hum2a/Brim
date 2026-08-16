import { z } from 'zod';
import type { Context } from 'hono';
import type { ApiBindings } from './env.js';
import { ownerFromContext } from './session.js';
import { createDb } from './db/client.js';
import { getSettings, getVehicle, saveSettings } from './db/repo.js';

const patchBody = z.object({
  defaultVehicleId: z.string().nullable().optional(),
});

export async function getSettingsHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await ownerFromContext(c);
  const row = await getSettings(createDb(c.env), session.ownerId);
  return c.json({
    defaultVehicleId: row?.default_vehicle_id ?? null,
  });
}

export async function patchSettingsHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await ownerFromContext(c);
  const parsed = patchBody.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
  const db = createDb(c.env);
  const defaultVehicleId = parsed.data.defaultVehicleId;
  if (defaultVehicleId) {
    if (!(await getVehicle(db, session.ownerId, defaultVehicleId))) {
      return c.json({ error: 'not_found' }, 404);
    }
  }
  const existing = await getSettings(db, session.ownerId);
  if (defaultVehicleId === null) {
    await saveSettings(db, {
      owner_id: session.ownerId,
      updated_at: new Date().toISOString(),
    });
    return c.json({ defaultVehicleId: null });
  }
  const row = await saveSettings(db, {
    owner_id: session.ownerId,
    updated_at: new Date().toISOString(),
    ...(defaultVehicleId
      ? { default_vehicle_id: defaultVehicleId }
      : existing?.default_vehicle_id
        ? { default_vehicle_id: existing.default_vehicle_id }
        : {}),
  });
  return c.json({ defaultVehicleId: row.default_vehicle_id ?? null });
}
