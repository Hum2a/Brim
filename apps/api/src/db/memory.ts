export type VehicleRow = {
  id: string;
  owner_id: string;
  nickname?: string;
  kind: 'car' | 'van' | 'motorcycle';
  propulsion: 'petrol' | 'diesel' | 'hybrid' | 'phev' | 'bev';
  make?: string;
  model?: string;
  derivative?: string;
  transmission?: string;
  year?: number;
  engine_cc?: number;
  co2_gkm?: number;
  euro_status?: string;
  euro_status_source?: 'dvla' | 'derived';
  official_consumption?: number;
  official_unit?: string;
  official_cycle?: string;
  tank_litres?: number;
  battery_kwh_usable?: number;
  has_heat_pump?: boolean;
  vca_match_id?: string;
  vrm_hash?: string;
  vrm_encrypted?: string;
  created_at: string;
};

export type TariffRow = {
  id: string;
  vehicle_id: string;
  kind: 'home' | 'public';
  pence_per_kwh: number;
  offpeak_pence?: number;
  offpeak_window?: string;
  network?: string;
  is_default: boolean;
};

export type JourneyRow = {
  id: string;
  owner_id: string;
  vehicle_id?: string;
  origin_label: string;
  dest_label: string;
  distance_meters: number;
  duration_seconds: number;
  polyline?: string;
  departs_at?: string;
  estimate_json: unknown;
  charges_json: unknown;
  is_saved: boolean;
  created_at: string;
};

export type FillUpRow = {
  id: string;
  vehicle_id: string;
  odometer_miles: number;
  quantity: number;
  unit: 'litres' | 'kwh';
  price_pence: number;
  filled_to_brim: boolean;
  occurred_at: string;
  note?: string;
};

export type CalibrationRow = {
  id: string;
  vehicle_id: string;
  calculated_value: number;
  unit: string;
  sample_count: number;
  stddev?: number;
  last_computed_at: string;
};

export type OwnerSettingsRow = {
  owner_id: string;
  default_vehicle_id?: string;
  updated_at: string;
};

export type SavedPlaceRow = {
  id: string;
  owner_id: string;
  kind: 'home' | 'work' | 'favourite';
  label: string;
  lat: number;
  lng: number;
  created_at: string;
};

export type AnonProfile = {
  id: string;
  created_at: string;
  claimed_by_user_id?: string;
};

export type UserRow = {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  created_at: string;
};

export type AuthMemoryDb = {
  user: Record<string, unknown>[];
  session: Record<string, unknown>[];
  account: Record<string, unknown>[];
  verification: Record<string, unknown>[];
};

type MemoryShape = {
  users: Map<string, UserRow>;
  usersByEmail: Map<string, string>;
  anon: Map<string, AnonProfile>;
  vehicles: Map<string, VehicleRow>;
  tariffs: Map<string, TariffRow>;
  journeys: Map<string, JourneyRow>;
  fillUps: Map<string, FillUpRow>;
  calibrations: Map<string, CalibrationRow>;
  settings: Map<string, OwnerSettingsRow>;
  places: Map<string, SavedPlaceRow>;
  routeCache: Map<string, { value: string; expiresAt: number }>;
};

const g = globalThis as { __brimMemory?: MemoryShape; __brimAuthMemory?: AuthMemoryDb };

function empty(): MemoryShape {
  return {
    users: new Map(),
    usersByEmail: new Map(),
    anon: new Map(),
    vehicles: new Map(),
    tariffs: new Map(),
    journeys: new Map(),
    fillUps: new Map(),
    calibrations: new Map(),
    settings: new Map(),
    places: new Map(),
    routeCache: new Map(),
  };
}

function emptyAuth(): AuthMemoryDb {
  return { user: [], session: [], account: [], verification: [] };
}

export function getMemoryDb(): MemoryShape {
  g.__brimMemory ??= empty();
  return g.__brimMemory;
}

export function getAuthMemory(): AuthMemoryDb {
  g.__brimAuthMemory ??= emptyAuth();
  return g.__brimAuthMemory;
}

export function resetMemoryDb(): void {
  g.__brimMemory = empty();
  g.__brimAuthMemory = emptyAuth();
}

export function createMemoryDb() {
  return getMemoryDb();
}
