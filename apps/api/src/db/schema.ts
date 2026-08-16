/**
 * Drizzle table map matching apps/api/src/db/migrations/0001_init.sql.
 * Runtime queries in fixture mode use the memory store; Neon uses this schema
 * once DATABASE_URL is supplied to createDb().
 *
 * Geography columns (origin_point, dest_point, station location, zone geometry)
 * are omitted until P7/P8. vrm_encrypted is stored but never written in P4.
 */
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  emailVerified: boolean('emailVerified').notNull(),
  image: text('image'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
  token: text('token').notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId').notNull(),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId').notNull(),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }),
  updatedAt: timestamp('updatedAt', { withTimezone: true }),
});

export const anonProfiles = pgTable('anon_profiles', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  claimedByUserId: text('claimed_by_user_id'),
});

export const vehicles = pgTable('vehicles', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  nickname: text('nickname'),
  kind: text('kind').notNull(),
  propulsion: text('propulsion').notNull(),
  make: text('make'),
  model: text('model'),
  derivative: text('derivative'),
  transmission: text('transmission'),
  year: integer('year'),
  engineCc: integer('engine_cc'),
  co2Gkm: integer('co2_gkm'),
  euroStatus: text('euro_status'),
  euroStatusSource: text('euro_status_source'),
  officialConsumption: doublePrecision('official_consumption'),
  officialUnit: text('official_unit'),
  officialCycle: text('official_cycle'),
  tankLitres: doublePrecision('tank_litres'),
  batteryKwhUsable: doublePrecision('battery_kwh_usable'),
  hasHeatPump: boolean('has_heat_pump'),
  vcaMatchId: text('vca_match_id'),
  vrmEncrypted: text('vrm_encrypted'),
  vrmHash: text('vrm_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const tariffs = pgTable('tariffs', {
  id: text('id').primaryKey(),
  vehicleId: text('vehicle_id').notNull(),
  kind: text('kind').notNull(),
  pencePerKwh: doublePrecision('pence_per_kwh').notNull(),
  offpeakPence: doublePrecision('offpeak_pence'),
  offpeakWindow: text('offpeak_window'),
  network: text('network'),
  isDefault: boolean('is_default').notNull(),
});

export const calibrations = pgTable('calibrations', {
  id: text('id').primaryKey(),
  vehicleId: text('vehicle_id').notNull(),
  calculatedValue: doublePrecision('calculated_value').notNull(),
  unit: text('unit').notNull(),
  sampleCount: integer('sample_count').notNull(),
  stddev: doublePrecision('stddev'),
  lastComputedAt: timestamp('last_computed_at', { withTimezone: true }).notNull(),
});

export const fillUps = pgTable('fill_ups', {
  id: text('id').primaryKey(),
  vehicleId: text('vehicle_id').notNull(),
  odometerMiles: doublePrecision('odometer_miles').notNull(),
  quantity: doublePrecision('quantity').notNull(),
  unit: text('unit').notNull(),
  pricePence: integer('price_pence').notNull(),
  stationId: text('station_id'),
  filledToBrim: boolean('filled_to_brim').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  note: text('note'),
});

export const journeys = pgTable('journeys', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  vehicleId: text('vehicle_id'),
  originLabel: text('origin_label').notNull(),
  destLabel: text('dest_label').notNull(),
  distanceMeters: doublePrecision('distance_meters').notNull(),
  durationSeconds: doublePrecision('duration_seconds').notNull(),
  polyline: text('polyline'),
  departsAt: timestamp('departs_at', { withTimezone: true }),
  estimateJson: jsonb('estimate_json').notNull(),
  chargesJson: jsonb('charges_json').notNull(),
  isSaved: boolean('is_saved').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const stations = pgTable('stations', {
  id: text('id').primaryKey(),
  brand: text('brand'),
  brandCanonical: text('brand_canonical'),
  name: text('name').notNull(),
  address: text('address'),
  postcode: text('postcode'),
  openingHoursJson: jsonb('opening_hours_json'),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  isStale: boolean('is_stale').notNull(),
});

export const stationPrices = pgTable(
  'station_prices',
  {
    stationId: text('station_id').notNull(),
    grade: text('grade').notNull(),
    priceTenthsPence: integer('price_tenths_pence').notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    rawPayloadJson: jsonb('raw_payload_json'),
  },
  (t) => ({ pk: primaryKey({ columns: [t.stationId, t.grade] }) }),
);

export const zones = pgTable('zones', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  authority: text('authority'),
  kind: text('kind').notNull(),
  cazClass: text('caz_class'),
  chargePence: integer('charge_pence'),
  isRestriction: boolean('is_restriction').notNull(),
  appliesHoursJson: jsonb('applies_hours_json'),
  sourceUrl: text('source_url'),
  verifiedOn: date('verified_on'),
  datasetVersion: text('dataset_version'),
});

export const tolls = pgTable('tolls', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  operator: text('operator'),
  chargePenceByClassJson: jsonb('charge_pence_by_class_json'),
  appliesHoursJson: jsonb('applies_hours_json'),
  sourceUrl: text('source_url'),
  verifiedOn: date('verified_on'),
});

export const vcaVehicles = pgTable(
  'vca_vehicles',
  {
    id: text('id').primaryKey(),
    make: text('make').notNull(),
    model: text('model').notNull(),
    derivative: text('derivative'),
    fuel: text('fuel'),
    engineCc: integer('engine_cc'),
    transmission: text('transmission'),
    co2Gkm: integer('co2_gkm'),
    consumptionCombined: doublePrecision('consumption_combined'),
    unit: text('unit'),
    cycle: text('cycle'),
    datasetVersion: text('dataset_version'),
  },
  (t) => ({ makeModelIdx: index('vca_vehicles_make_model').on(t.make, t.model) }),
);

export const gridIntensity = pgTable('grid_intensity', {
  region: text('region').notNull(),
  intensityGPerKwh: doublePrecision('intensity_g_per_kwh').notNull(),
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
  validTo: timestamp('valid_to', { withTimezone: true }).notNull(),
});

export const routeCache = pgTable('route_cache', {
  cacheKey: text('cache_key').primaryKey(),
  provider: text('provider').notNull(),
  responseJson: jsonb('response_json').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const schema = {
  user,
  session,
  account,
  verification,
  anonProfiles,
  vehicles,
  tariffs,
  calibrations,
  fillUps,
  journeys,
  stations,
  stationPrices,
  zones,
  tolls,
  vcaVehicles,
  gridIntensity,
  routeCache,
};
