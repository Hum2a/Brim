import { z } from 'zod';
import { computeEstimate } from '@brim/engine';
import {
  hmrcAmapPence,
  parseMapsUrl,
  propulsionSchema,
  searchPlaces,
  ukTaxYearStartUtc,
  vehicleProfileSchema,
} from '@brim/shared';
import {
  DurableNoopCache,
  KvCache,
  MemoryCache,
  cachedRoute,
  chooseProvider,
  routeCacheKey,
} from '@brim/routing';
import type { Context } from 'hono';
import type { ApiBindings } from './env.js';
import { createLogger } from './logger.js';
import { createDb } from './db/client.js';
import { ownerFromContext } from './session.js';
import { getVehicle, ytdMiles } from './db/repo.js';
import type { VehicleRow } from './db/memory.js';

const estimateBodySchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  waypoints: z.array(z.string()).optional(),
  departsAt: z.string().optional(),
  vehicleId: z.string().optional(),
  vehicleInline: vehicleProfileSchema.optional(),
  propulsion: propulsionSchema.optional(),
  priceStrategy: z.enum(['national-median', 'user-tariff', 'hardcoded-fallback']).optional(),
  pricePence: z.number().optional(),
  nowIso: z.string().optional(),
});

const isolateCache = new MemoryCache();
const log = createLogger();
let providerCalls = 0;

function cacheFor(env: ApiBindings) {
  if (env.ROUTE_CACHE) return new KvCache(env.ROUTE_CACHE);
  if (env.DATABASE_URL) return new DurableNoopCache();
  return isolateCache;
}

function vehicleFromRow(row: VehicleRow) {
  const profile: {
    kind: VehicleRow['kind'];
    propulsion: VehicleRow['propulsion'];
    make?: string;
    model?: string;
    year?: number;
    officialConsumption?: number;
    officialUnit?: 'mpg' | 'l/100km' | 'mi/kWh' | 'kWh/100km';
    officialCycle?: 'WLTP' | 'NEDC';
    tankLitres?: number;
    batteryKwhUsable?: number;
    hasHeatPump?: boolean;
    euroStatus?: string;
    euroStatusSource?: 'dvla' | 'derived';
  } = { kind: row.kind, propulsion: row.propulsion };
  if (row.make) profile.make = row.make;
  if (row.model) profile.model = row.model;
  if (row.year !== undefined) profile.year = row.year;
  if (row.official_consumption !== undefined)
    profile.officialConsumption = row.official_consumption;
  if (
    row.official_unit === 'mpg' ||
    row.official_unit === 'l/100km' ||
    row.official_unit === 'mi/kWh' ||
    row.official_unit === 'kWh/100km'
  ) {
    profile.officialUnit = row.official_unit;
  }
  if (row.official_cycle === 'WLTP' || row.official_cycle === 'NEDC')
    profile.officialCycle = row.official_cycle;
  if (row.tank_litres !== undefined) profile.tankLitres = row.tank_litres;
  if (row.battery_kwh_usable !== undefined) profile.batteryKwhUsable = row.battery_kwh_usable;
  if (row.has_heat_pump !== undefined) profile.hasHeatPump = row.has_heat_pump;
  if (row.euro_status) profile.euroStatus = row.euro_status;
  if (row.euro_status_source) profile.euroStatusSource = row.euro_status_source;
  return profile;
}

async function estimateFromBody(c: Context<{ Bindings: ApiBindings }>, raw: unknown) {
  createDb(c.env);
  const parsed = estimateBodySchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400);
  }
  const body = parsed.data;
  const session = await ownerFromContext(c);

  const saved = body.vehicleId ? getVehicle(session.ownerId, body.vehicleId) : undefined;
  const vehicleInline = body.vehicleInline ?? (saved ? vehicleFromRow(saved) : undefined);
  const propulsion = vehicleInline?.propulsion ?? body.propulsion ?? 'petrol';
  const hasProfile = Boolean(vehicleInline);
  const chosen = chooseProvider({
    fixtureMode: c.env.BRIM_FIXTURES === '1',
    googleKey: c.env.GOOGLE_MAPS_API_KEY,
    osrmUrl: c.env.OSRM_URL,
    spentUsd: Number(c.env.ROUTING_SPENT_USD ?? 0),
    ceilingUsd: Number(c.env.ROUTING_CEILING_USD ?? 50),
    hasVehicleProfile: hasProfile,
  });
  const cache = cacheFor(c.env);
  const key = routeCacheKey({
    origin: body.origin.toLowerCase(),
    dest: body.destination.toLowerCase(),
    mode: chosen.mode,
    provider: chosen.provider.name,
    departureTime: body.departsAt,
  });
  const ttl = chosen.mode === 'advanced' ? 6 * 3600 : 30 * 24 * 3600;
  const { value: route, hit } = await cachedRoute(cache, key, ttl, () => {
    providerCalls += 1;
    return chosen.provider.computeRoute({
      origin: body.origin,
      destination: body.destination,
      waypoints: body.waypoints,
      mode: chosen.mode,
    });
  });

  log.info({ branch: chosen.branch, mode: chosen.mode, budget: chosen.budgetAlert, cacheHit: hit });

  const unit =
    vehicleInline?.officialUnit === 'mi/kWh' || vehicleInline?.officialUnit === 'kWh/100km'
      ? vehicleInline.officialUnit
      : vehicleInline?.officialUnit === 'mpg'
        ? 'mpg'
        : 'l/100km';

  const nowIso = body.nowIso ?? body.departsAt ?? '1970-01-01T00:00:00Z';
  const estimate = computeEstimate({
    distanceMeters: route.distanceMeters,
    durationSeconds: route.durationSeconds,
    propulsion,
    vehicle: vehicleInline,
    official:
      vehicleInline?.officialConsumption !== undefined
        ? {
            value: vehicleInline.officialConsumption,
            unit,
            cycle: vehicleInline.officialCycle ?? 'WLTP',
          }
        : undefined,
    userEntered:
      body.vehicleInline?.userEnteredConsumption !== undefined
        ? {
            value: body.vehicleInline.userEnteredConsumption,
            unit: body.vehicleInline.userEnteredUnit ?? 'mpg',
          }
        : undefined,
    providerEstimate: route.providerFuelLitres ? { litres: route.providerFuelLitres } : undefined,
    roadComposition: route.roadComposition,
    pricePence: body.pricePence ?? (propulsion === 'bev' ? 7.5 : 140),
    priceUnit: propulsion === 'bev' ? 'p/kWh' : 'ppl',
    priceSource: body.priceStrategy === 'user-tariff' ? 'user-tariff' : 'national-median',
    priceObservedAt: nowIso,
    charges: [],
    gridIntensityGPerKwh: 150,
  });

  if (chosen.exceeded) {
    estimate.reasons.push(
      'Routing spend ceiling hit — used the free provider and widened the range.',
    );
  }

  const miles = route.distanceMeters / 1609.344;
  const ytd = ytdMiles(session.ownerId, ukTaxYearStartUtc(nowIso), nowIso);
  const hmrc = hmrcAmapPence(miles, ytd);

  return c.json({
    ...estimate,
    hmrc: {
      approvedPence: hmrc.approvedPence,
      ytdMiles: ytd,
      bandMiles45: hmrc.bandMiles45,
      bandMiles25: hmrc.bandMiles25,
      crossedThreshold: hmrc.crossedThreshold,
    },
  });
}

export async function handleEstimate(c: Context<{ Bindings: ApiBindings }>) {
  return estimateFromBody(c, await c.req.json());
}

export async function handleFromMapsUrl(c: Context<{ Bindings: ApiBindings }>) {
  const body = z.object({ url: z.string() }).safeParse(await c.req.json());
  if (!body.success) return c.json({ error: 'invalid_request' }, 400);
  const parsed = parseMapsUrl(body.data.url);
  if (!parsed.ok) return c.json({ error: 'invalid_maps_url', reason: parsed.reason }, 400);
  return estimateFromBody(c, {
    origin: parsed.origin,
    destination: parsed.destination,
    waypoints: parsed.waypoints,
  });
}

export function handlePlaces(c: Context<{ Bindings: ApiBindings }>) {
  const q = c.req.query('q') ?? '';
  return c.json({ places: searchPlaces(q) });
}

export function cacheStats() {
  return { providerCalls };
}
