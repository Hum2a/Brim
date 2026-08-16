-- Brim §12 schema. RLS is created in the same migration as the tables.
CREATE EXTENSION IF NOT EXISTS postgis;

-- Better Auth managed tables (generated shape; do not rename columns).
CREATE TABLE IF NOT EXISTS "user" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  image TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  token TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMPTZ,
  "refreshTokenExpiresAt" TIMESTAMPTZ,
  scope TEXT,
  password TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS anon_profiles (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_by_user_id TEXT REFERENCES "user"(id)
);

CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  nickname TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('car', 'van', 'motorcycle')),
  propulsion TEXT NOT NULL CHECK (propulsion IN ('petrol', 'diesel', 'hybrid', 'phev', 'bev')),
  make TEXT,
  model TEXT,
  derivative TEXT,
  transmission TEXT,
  year INTEGER,
  engine_cc INTEGER,
  co2_gkm INTEGER,
  euro_status TEXT,
  euro_status_source TEXT CHECK (euro_status_source IN ('dvla', 'derived')),
  official_consumption DOUBLE PRECISION,
  official_unit TEXT,
  official_cycle TEXT,
  tank_litres DOUBLE PRECISION,
  battery_kwh_usable DOUBLE PRECISION,
  has_heat_pump BOOLEAN,
  vca_match_id TEXT,
  vrm_encrypted TEXT,
  vrm_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tariffs (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('home', 'public')),
  pence_per_kwh DOUBLE PRECISION NOT NULL,
  offpeak_pence DOUBLE PRECISION,
  offpeak_window TEXT,
  network TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS calibrations (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  calculated_value DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL,
  sample_count INTEGER NOT NULL,
  stddev DOUBLE PRECISION,
  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fill_ups (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  odometer_miles DOUBLE PRECISION NOT NULL,
  quantity DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('litres', 'kwh')),
  price_pence INTEGER NOT NULL,
  station_id TEXT,
  filled_to_brim BOOLEAN NOT NULL DEFAULT false,
  occurred_at TIMESTAMPTZ NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS journeys (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  vehicle_id TEXT,
  origin_label TEXT NOT NULL,
  dest_label TEXT NOT NULL,
  origin_point geography(Point, 4326),
  dest_point geography(Point, 4326),
  distance_meters DOUBLE PRECISION NOT NULL,
  duration_seconds DOUBLE PRECISION NOT NULL,
  polyline TEXT,
  departs_at TIMESTAMPTZ,
  estimate_json JSONB NOT NULL,
  charges_json JSONB NOT NULL,
  is_saved BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stations (
  id TEXT PRIMARY KEY,
  brand TEXT,
  brand_canonical TEXT,
  name TEXT NOT NULL,
  address TEXT,
  postcode TEXT,
  location geography(Point, 4326),
  opening_hours_json JSONB,
  last_seen_at TIMESTAMPTZ,
  is_stale BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS station_prices (
  station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  grade TEXT NOT NULL CHECK (grade IN ('E10', 'E5', 'B7', 'SDV', 'LPG')),
  price_tenths_pence INTEGER NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  raw_payload_json JSONB,
  PRIMARY KEY (station_id, grade)
);

CREATE TABLE IF NOT EXISTS zones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  authority TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('caz', 'ulez', 'congestion', 'lez')),
  caz_class TEXT,
  charge_pence INTEGER,
  is_restriction BOOLEAN NOT NULL DEFAULT false,
  applies_hours_json JSONB,
  geometry geography(Polygon, 4326),
  source_url TEXT,
  verified_on DATE,
  dataset_version TEXT
);

CREATE TABLE IF NOT EXISTS tolls (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  operator TEXT,
  location geography,
  charge_pence_by_class_json JSONB,
  applies_hours_json JSONB,
  source_url TEXT,
  verified_on DATE
);

CREATE TABLE IF NOT EXISTS vca_vehicles (
  id TEXT PRIMARY KEY,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  derivative TEXT,
  fuel TEXT,
  engine_cc INTEGER,
  transmission TEXT,
  co2_gkm INTEGER,
  consumption_combined DOUBLE PRECISION,
  unit TEXT,
  cycle TEXT,
  dataset_version TEXT
);

CREATE TABLE IF NOT EXISTS grid_intensity (
  region TEXT NOT NULL,
  intensity_g_per_kwh DOUBLE PRECISION NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS route_cache (
  cache_key TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  response_json JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fill_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE tolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE vca_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE grid_intensity ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE anon_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY vehicles_owner ON vehicles USING (owner_id = current_setting('brim.owner_id', true));
CREATE POLICY tariffs_owner ON tariffs USING (
  vehicle_id IN (SELECT id FROM vehicles WHERE owner_id = current_setting('brim.owner_id', true))
);
CREATE POLICY fill_ups_owner ON fill_ups USING (
  vehicle_id IN (SELECT id FROM vehicles WHERE owner_id = current_setting('brim.owner_id', true))
);
CREATE POLICY journeys_owner ON journeys USING (owner_id = current_setting('brim.owner_id', true));
CREATE POLICY calibrations_owner ON calibrations USING (
  vehicle_id IN (SELECT id FROM vehicles WHERE owner_id = current_setting('brim.owner_id', true))
);
CREATE POLICY stations_read ON stations FOR SELECT USING (true);
CREATE POLICY station_prices_read ON station_prices FOR SELECT USING (true);
CREATE POLICY zones_read ON zones FOR SELECT USING (true);
CREATE POLICY tolls_read ON tolls FOR SELECT USING (true);
CREATE POLICY vca_read ON vca_vehicles FOR SELECT USING (true);
CREATE POLICY grid_read ON grid_intensity FOR SELECT USING (true);
CREATE POLICY route_cache_service ON route_cache USING (current_setting('brim.service_role', true) = '1');
CREATE POLICY anon_profiles_self ON anon_profiles USING (id = current_setting('brim.owner_id', true));
