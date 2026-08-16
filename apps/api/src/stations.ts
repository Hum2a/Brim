import { isFixtureMode } from '@brim/shared';
import type { Context } from 'hono';
import type { ApiBindings } from './env.js';
import { createDb } from './db/client.js';
import { persistLive } from './db/repo.js';
import {
  decorateNearby,
  fixtureCorpus,
  liveNationalMedians,
  liveNearby,
  nationalMediansFromObservations,
  nearbyFromObservations,
  radiusMetersFromQuery,
} from './prices.js';
import { handleStationsNearRoute } from './fill.js';

function parseFuelGrade(raw: string | undefined) {
  if (raw === 'E10' || raw === 'E5' || raw === 'B7' || raw === 'SDV' || raw === 'LPG') return raw;
  return undefined;
}

export async function handleStationsNear(c: Context<{ Bindings: ApiBindings }>) {
  const lat = Number(c.req.query('lat'));
  const lng = Number(c.req.query('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return c.json({ error: 'invalid_request', reason: 'lat and lng are required' }, 400);
  }
  const grade = parseFuelGrade(c.req.query('grade'));
  const radiusMeters = radiusMetersFromQuery(c.req.query('radiusKm'));
  if (isFixtureMode(c.env.BRIM_FIXTURES)) {
    const corpus = fixtureCorpus(c.env.BRIM_FIXTURES);
    const hits = nearbyFromObservations(corpus.observations, {
      lat,
      lng,
      radiusMeters,
      ...(grade ? { grade } : {}),
    });
    return c.json({ stations: decorateNearby(hits, corpus.stations) });
  }
  const db = createDb(c.env);
  if (!persistLive(db)) return c.json({ stations: [] });
  const stations = await liveNearby(db, {
    lat,
    lng,
    radiusMeters,
    ...(grade ? { grade } : {}),
  });
  return c.json({ stations: Array.isArray(stations) ? stations : [] });
}

export async function handleMetaPrices(c: Context<{ Bindings: ApiBindings }>) {
  if (isFixtureMode(c.env.BRIM_FIXTURES)) {
    const corpus = fixtureCorpus(c.env.BRIM_FIXTURES);
    return c.json({ grades: nationalMediansFromObservations(corpus.observations) });
  }
  const db = createDb(c.env);
  if (!persistLive(db)) return c.json({ grades: {} });
  return c.json({ grades: await liveNationalMedians(db) });
}

export { handleStationsNearRoute };
