import { z } from 'zod';
import type { Context } from 'hono';
import type { ApiBindings } from './env.js';
import { ownerFromContext } from './session.js';
import { createDb } from './db/client.js';
import type { SavedPlaceRow } from './db/memory.js';
import { deletePlace, getPlace, listPlaces, savePlace } from './db/repo.js';

const FAVOURITE_CAP = 20;

const placeBody = z.object({
  kind: z.enum(['home', 'work', 'favourite']),
  label: z.string().min(1).max(200),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
});

function publicPlace(row: SavedPlaceRow) {
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    lat: row.lat,
    lng: row.lng,
  };
}

export async function listPlacesHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await ownerFromContext(c);
  const places = await listPlaces(createDb(c.env), session.ownerId);
  return c.json({ places: places.map(publicPlace) });
}

export async function createPlaceHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await ownerFromContext(c);
  const parsed = placeBody.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
  const db = createDb(c.env);
  const existing = await listPlaces(db, session.ownerId);
  if (parsed.data.kind === 'favourite') {
    const favs = existing.filter((p) => p.kind === 'favourite');
    if (favs.length >= FAVOURITE_CAP) return c.json({ error: 'favourite_limit' }, 400);
  }
  const reuse =
    parsed.data.kind === 'home' || parsed.data.kind === 'work'
      ? existing.find((p) => p.kind === parsed.data.kind)
      : undefined;
  const row = await savePlace(db, {
    id: reuse?.id ?? crypto.randomUUID(),
    owner_id: session.ownerId,
    kind: parsed.data.kind,
    label: parsed.data.label,
    lat: parsed.data.lat,
    lng: parsed.data.lng,
    created_at: reuse?.created_at ?? new Date().toISOString(),
  });
  return c.json(publicPlace(row), reuse ? 200 : 201);
}

export async function patchPlaceHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await ownerFromContext(c);
  const db = createDb(c.env);
  const existing = await getPlace(db, session.ownerId, c.req.param('id') ?? '');
  if (!existing) return c.json({ error: 'not_found' }, 404);
  const parsed = placeBody.partial().safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
  const next: SavedPlaceRow = { ...existing };
  if (parsed.data.kind) next.kind = parsed.data.kind;
  if (parsed.data.label) next.label = parsed.data.label;
  if (parsed.data.lat !== undefined) next.lat = parsed.data.lat;
  if (parsed.data.lng !== undefined) next.lng = parsed.data.lng;
  return c.json(publicPlace(await savePlace(db, next)));
}

export async function deletePlaceHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await ownerFromContext(c);
  if (!(await deletePlace(createDb(c.env), session.ownerId, c.req.param('id') ?? ''))) {
    return c.json({ error: 'not_found' }, 404);
  }
  return c.json({ ok: true });
}
