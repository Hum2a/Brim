import { z } from 'zod';
import { computeEstimate } from '@brim/engine';
import {
  decodePolyline,
  findPlaceByLabel,
  hmrcAmapPence,
  isFixtureMode,
  parseLatLngString,
  parseMapsUrl,
  propulsionSchema,
  ukTaxYearStartUtc,
  vehicleProfileSchema,
} from '@brim/shared';
import type { RoutePlace, RouteRequest } from '@brim/routing';
import {
  KvCache,
  MemoryCache,
  cachePlaceKey,
  cachedRoute,
  chooseProvider,
  routeCacheKey,
} from '@brim/routing';
import type { Context } from 'hono';
import type { ApiBindings } from './env.js';
import { createLogger } from './logger.js';
import { createDb } from './db/client.js';
import { NeonRouteCache } from './db/route-cache.js';
import { ownerFromContext } from './session.js';
import { getDefaultTariff, getVehicle, persistLive, ytdMiles } from './db/repo.js';
import type { BrimDb } from './db/types.js';
import type { VehicleRow } from './db/memory.js';

const placePinSchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  label: z.string().optional(),
});
const placeInputSchema = z.union([z.string().min(1), placePinSchema]);

const estimateBodySchema = z.object({
  origin: placeInputSchema,
  destination: placeInputSchema,
  waypoints: z.array(placeInputSchema).optional(),
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

function cacheFor(env: ApiBindings, db: BrimDb) {
  if (env.ROUTE_CACHE) return new KvCache(env.ROUTE_CACHE);
  if (persistLive(db)) return new NeonRouteCache(db);
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
  const db = createDb(c.env);
  const parsed = estimateBodySchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400);
  }
  const body = parsed.data;
  const session = await ownerFromContext(c);

  const saved = body.vehicleId ? await getVehicle(db, session.ownerId, body.vehicleId) : undefined;
  const vehicleInline = body.vehicleInline ?? (saved ? vehicleFromRow(saved) : undefined);
  const propulsion = vehicleInline?.propulsion ?? body.propulsion ?? 'petrol';
  const hasProfile = Boolean(vehicleInline);
  const chosen = chooseProvider({
    fixtureMode: isFixtureMode(c.env.BRIM_FIXTURES),
    googleKey: c.env.GOOGLE_MAPS_API_KEY,
    osrmUrl: c.env.OSRM_URL,
    spentUsd: Number(c.env.ROUTING_SPENT_USD ?? 0),
    ceilingUsd: Number(c.env.ROUTING_CEILING_USD ?? 50),
    hasVehicleProfile: hasProfile,
  });
  const origin = resolvePlace(body.origin);
  const destination = resolvePlace(body.destination);
  const waypoints = body.waypoints?.map(resolvePlace);
  const cache = cacheFor(c.env, db);
  const key = routeCacheKey({
    origin: cachePlaceKey(origin.route),
    dest: cachePlaceKey(destination.route),
    mode: chosen.mode,
    provider: chosen.provider.name,
    departureTime: body.departsAt,
    waypoints: waypoints?.map((w) => cachePlaceKey(w.route)).join(";"),
  });
  const ttl = chosen.mode === 'advanced' ? 6 * 3600 : 30 * 24 * 3600;
  const { value: route, hit } = await cachedRoute(cache, key, ttl, () => {
    providerCalls += 1;
    const req: RouteRequest = {
      origin: origin.route,
      destination: destination.route,
      mode: chosen.mode,
    };
    if (waypoints && waypoints.length > 0) req.waypoints = waypoints.map((w) => w.route);
    if (body.departsAt) req.departureTime = body.departsAt;
    return chosen.provider.computeRoute(req);
  });

  log.info({ branch: chosen.branch, mode: chosen.mode, budget: chosen.budgetAlert, cacheHit: hit });

  const unit =
    vehicleInline?.officialUnit === 'mi/kWh' || vehicleInline?.officialUnit === 'kWh/100km'
      ? vehicleInline.officialUnit
      : vehicleInline?.officialUnit === 'mpg'
        ? 'mpg'
        : 'l/100km';

  const nowIso = body.nowIso ?? body.departsAt ?? '1970-01-01T00:00:00Z';
  const tariff =
    body.priceStrategy === 'user-tariff' && body.vehicleId
      ? await getDefaultTariff(db, session.ownerId, body.vehicleId)
      : undefined;
  const fallbackPence = propulsion === 'bev' ? 7.5 : 140;
  const pricePence = body.pricePence ?? tariff?.pence_per_kwh ?? fallbackPence;
  const priceUnit = propulsion === 'bev' ? 'p/kWh' : 'ppl';
  const priceSource =
    body.priceStrategy === 'user-tariff' && (tariff || body.pricePence !== undefined)
      ? 'user-tariff'
      : 'national-median';

  const estimateFor = (distanceMeters: number, durationSeconds: number, providerFuel?: number) =>
    computeEstimate({
      distanceMeters,
      durationSeconds,
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
      providerEstimate: providerFuel ? { litres: providerFuel } : undefined,
      roadComposition: route.roadComposition,
      pricePence,
      priceUnit,
      priceSource,
      priceObservedAt: nowIso,
      charges: [],
      gridIntensityGPerKwh: 150,
    });

  const estimate = estimateFor(
    route.distanceMeters,
    route.durationSeconds,
    route.providerFuelLitres,
  );

  if (chosen.exceeded) {
    estimate.reasons.push(
      'Routing spend ceiling hit - used the free provider and widened the range.',
    );
  }

  const miles = route.distanceMeters / 1609.344;
  const ytd = await ytdMiles(db, session.ownerId, ukTaxYearStartUtc(nowIso), nowIso);
  const hmrc = hmrcAmapPence(miles, ytd);
  const shape = decodePolyline(route.encodedPolyline);
  const start = route.start ?? shape[0];
  const end = route.end ?? shape[shape.length - 1];
  const alternatives = (route.alternatives ?? []).map((alt) => {
    const priced = estimateFor(alt.distanceMeters, alt.durationSeconds);
    return {
      id: alt.id,
      label: alt.label,
      distanceMeters: alt.distanceMeters,
      durationSeconds: alt.durationSeconds,
      encodedPolyline: alt.encodedPolyline,
      costPence: priced.cost.totalPence.point,
    };
  });
  const waypointPins = (waypoints ?? [])
    .map((w) => pinFrom(w, undefined))
    .filter((p): p is { label: string; lat: number; lng: number } => Boolean(p));

  const payload: Record<string, unknown> = {
    ...estimate,
    encodedPolyline: route.encodedPolyline,
    origin: pinFrom(origin, start),
    destination: pinFrom(destination, end),
    alternatives,
    hmrc: {
      approvedPence: hmrc.approvedPence,
      ytdMiles: ytd,
      bandMiles45: hmrc.bandMiles45,
      bandMiles25: hmrc.bandMiles25,
      crossedThreshold: hmrc.crossedThreshold,
    },
  };
  if (route.routeLabel) payload.routeLabel = route.routeLabel;
  if (route.durationTrafficSeconds !== undefined) {
    payload.durationTrafficSeconds = route.durationTrafficSeconds;
  }
  if (waypointPins.length > 0) payload.waypoints = waypointPins;
  return c.json(payload);
}

function pinFrom(
  resolved: { label: string; lat?: number; lng?: number },
  fallback: { lat: number; lng: number } | undefined,
): { label: string; lat: number; lng: number } | undefined {
  const lat = resolved.lat ?? fallback?.lat;
  const lng = resolved.lng ?? fallback?.lng;
  if (lat === undefined || lng === undefined) return undefined;
  return { label: resolved.label, lat, lng };
}

function resolvePlace(input: z.infer<typeof placeInputSchema>): {
  route: RoutePlace;
  label: string;
  lat?: number;
  lng?: number;
} {
  if (typeof input !== 'string') {
    const label = input.label?.trim() || `${input.lat.toFixed(4)}, ${input.lng.toFixed(4)}`;
    const route: RoutePlace = input.label
      ? { lat: input.lat, lng: input.lng, label: input.label }
      : { lat: input.lat, lng: input.lng };
    return { route, label, lat: input.lat, lng: input.lng };
  }
  const named = findPlaceByLabel(input);
  if (named) {
    return {
      route: { lat: named.lat, lng: named.lng, label: named.label },
      label: named.label,
      lat: named.lat,
      lng: named.lng,
    };
  }
  const parsed = parseLatLngString(input);
  if (parsed) {
    return { route: parsed, label: input.trim(), lat: parsed.lat, lng: parsed.lng };
  }
  return { route: input, label: input };
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

export function cacheStats() {
  return { providerCalls };
}
