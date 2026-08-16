import { and, desc, eq, gte, lte } from 'drizzle-orm';
import {
  anonProfiles,
  calibrations,
  fillUps,
  journeys,
  ownerSettings,
  routeCache,
  savedPlaces,
  tariffs,
  vehicles,
} from './schema.js';
import type {
  CalibrationRow,
  FillUpRow,
  JourneyRow,
  OwnerSettingsRow,
  SavedPlaceRow,
  TariffRow,
  VehicleRow,
} from './memory.js';
import { withRls, type RlsTx } from './with-rls.js';
import type { BrimDb } from './types.js';

function iso(value: Date | string | null | undefined): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.length > 0) return value;
  return new Date().toISOString();
}

function optString(value: string | null | undefined): string | undefined {
  return value ? value : undefined;
}

function optNumber(value: number | null | undefined): number | undefined {
  return value === null || value === undefined ? undefined : value;
}

function optBool(value: boolean | null | undefined): boolean | undefined {
  return value === null || value === undefined ? undefined : value;
}

function asKind(value: string): VehicleRow['kind'] {
  if (value === 'van' || value === 'motorcycle') return value;
  return 'car';
}

function asPropulsion(value: string): VehicleRow['propulsion'] {
  if (
    value === 'diesel' ||
    value === 'hybrid' ||
    value === 'phev' ||
    value === 'bev'
  ) {
    return value;
  }
  return 'petrol';
}

function asEuroSource(value: string | null | undefined): VehicleRow['euro_status_source'] {
  if (value === 'dvla' || value === 'derived') return value;
  return undefined;
}

function asTariffKind(value: string): TariffRow['kind'] {
  return value === 'public' ? 'public' : 'home';
}

export function fromVehicle(row: typeof vehicles.$inferSelect): VehicleRow {
  const mapped: VehicleRow = {
    id: row.id,
    owner_id: row.ownerId,
    kind: asKind(row.kind),
    propulsion: asPropulsion(row.propulsion),
    created_at: iso(row.createdAt),
  };
  const nickname = optString(row.nickname);
  if (nickname) mapped.nickname = nickname;
  const make = optString(row.make);
  if (make) mapped.make = make;
  const model = optString(row.model);
  if (model) mapped.model = model;
  const derivative = optString(row.derivative);
  if (derivative) mapped.derivative = derivative;
  const transmission = optString(row.transmission);
  if (transmission) mapped.transmission = transmission;
  const year = optNumber(row.year);
  if (year !== undefined) mapped.year = year;
  const engineCc = optNumber(row.engineCc);
  if (engineCc !== undefined) mapped.engine_cc = engineCc;
  const co2 = optNumber(row.co2Gkm);
  if (co2 !== undefined) mapped.co2_gkm = co2;
  const euro = optString(row.euroStatus);
  if (euro) mapped.euro_status = euro;
  const euroSource = asEuroSource(row.euroStatusSource);
  if (euroSource) mapped.euro_status_source = euroSource;
  const official = optNumber(row.officialConsumption);
  if (official !== undefined) mapped.official_consumption = official;
  const officialUnit = optString(row.officialUnit);
  if (officialUnit) mapped.official_unit = officialUnit;
  const officialCycle = optString(row.officialCycle);
  if (officialCycle) mapped.official_cycle = officialCycle;
  const tank = optNumber(row.tankLitres);
  if (tank !== undefined) mapped.tank_litres = tank;
  const battery = optNumber(row.batteryKwhUsable);
  if (battery !== undefined) mapped.battery_kwh_usable = battery;
  const heatPump = optBool(row.hasHeatPump);
  if (heatPump !== undefined) mapped.has_heat_pump = heatPump;
  const vca = optString(row.vcaMatchId);
  if (vca) mapped.vca_match_id = vca;
  const vrmHash = optString(row.vrmHash);
  if (vrmHash) mapped.vrm_hash = vrmHash;
  const vrmEncrypted = optString(row.vrmEncrypted);
  if (vrmEncrypted) mapped.vrm_encrypted = vrmEncrypted;
  return mapped;
}

function vehicleValues(row: VehicleRow) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    nickname: row.nickname ?? null,
    kind: row.kind,
    propulsion: row.propulsion,
    make: row.make ?? null,
    model: row.model ?? null,
    derivative: row.derivative ?? null,
    transmission: row.transmission ?? null,
    year: row.year ?? null,
    engineCc: row.engine_cc ?? null,
    co2Gkm: row.co2_gkm ?? null,
    euroStatus: row.euro_status ?? null,
    euroStatusSource: row.euro_status_source ?? null,
    officialConsumption: row.official_consumption ?? null,
    officialUnit: row.official_unit ?? null,
    officialCycle: row.official_cycle ?? null,
    tankLitres: row.tank_litres ?? null,
    batteryKwhUsable: row.battery_kwh_usable ?? null,
    hasHeatPump: row.has_heat_pump ?? null,
    vcaMatchId: row.vca_match_id ?? null,
    vrmHash: row.vrm_hash ?? null,
    vrmEncrypted: row.vrm_encrypted ?? null,
    createdAt: new Date(row.created_at),
  };
}

export function fromTariff(row: typeof tariffs.$inferSelect): TariffRow {
  const mapped: TariffRow = {
    id: row.id,
    vehicle_id: row.vehicleId,
    kind: asTariffKind(row.kind),
    pence_per_kwh: row.pencePerKwh,
    is_default: row.isDefault,
  };
  const offpeak = optNumber(row.offpeakPence);
  if (offpeak !== undefined) mapped.offpeak_pence = offpeak;
  const window = optString(row.offpeakWindow);
  if (window) mapped.offpeak_window = window;
  const network = optString(row.network);
  if (network) mapped.network = network;
  return mapped;
}

function tariffValues(row: TariffRow) {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    kind: row.kind,
    pencePerKwh: row.pence_per_kwh,
    offpeakPence: row.offpeak_pence ?? null,
    offpeakWindow: row.offpeak_window ?? null,
    network: row.network ?? null,
    isDefault: row.is_default,
  };
}

export function fromJourney(row: typeof journeys.$inferSelect): JourneyRow {
  const mapped: JourneyRow = {
    id: row.id,
    owner_id: row.ownerId,
    origin_label: row.originLabel,
    dest_label: row.destLabel,
    distance_meters: row.distanceMeters,
    duration_seconds: row.durationSeconds,
    estimate_json: row.estimateJson,
    charges_json: row.chargesJson,
    is_saved: row.isSaved,
    created_at: iso(row.createdAt),
  };
  const vehicleId = optString(row.vehicleId);
  if (vehicleId) mapped.vehicle_id = vehicleId;
  const polyline = optString(row.polyline);
  if (polyline) mapped.polyline = polyline;
  if (row.departsAt) mapped.departs_at = iso(row.departsAt);
  return mapped;
}

function journeyValues(row: JourneyRow) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    vehicleId: row.vehicle_id ?? null,
    originLabel: row.origin_label,
    destLabel: row.dest_label,
    distanceMeters: row.distance_meters,
    durationSeconds: row.duration_seconds,
    polyline: row.polyline ?? null,
    departsAt: row.departs_at ? new Date(row.departs_at) : null,
    estimateJson: row.estimate_json,
    chargesJson: row.charges_json,
    isSaved: row.is_saved,
    createdAt: new Date(row.created_at),
  };
}

export function fromFillUp(row: typeof fillUps.$inferSelect): FillUpRow {
  const mapped: FillUpRow = {
    id: row.id,
    vehicle_id: row.vehicleId,
    odometer_miles: row.odometerMiles,
    quantity: row.quantity,
    unit: row.unit === 'kwh' ? 'kwh' : 'litres',
    price_pence: row.pricePence,
    filled_to_brim: row.filledToBrim,
    occurred_at: iso(row.occurredAt),
  };
  const note = optString(row.note);
  if (note) mapped.note = note;
  const stationId = optString(row.stationId);
  if (stationId) mapped.station_id = stationId;
  return mapped;
}

function fillUpValues(row: FillUpRow) {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    odometerMiles: row.odometer_miles,
    quantity: row.quantity,
    unit: row.unit,
    pricePence: row.price_pence,
    filledToBrim: row.filled_to_brim,
    occurredAt: new Date(row.occurred_at),
    note: row.note ?? null,
    stationId: row.station_id ?? null,
  };
}

export function fromCalibration(row: typeof calibrations.$inferSelect): CalibrationRow {
  const mapped: CalibrationRow = {
    id: row.id,
    vehicle_id: row.vehicleId,
    calculated_value: row.calculatedValue,
    unit: row.unit,
    sample_count: row.sampleCount,
    last_computed_at: iso(row.lastComputedAt),
  };
  const stddev = optNumber(row.stddev);
  if (stddev !== undefined) mapped.stddev = stddev;
  return mapped;
}

export function fromSettings(row: typeof ownerSettings.$inferSelect): OwnerSettingsRow {
  const mapped: OwnerSettingsRow = {
    owner_id: row.ownerId,
    updated_at: iso(row.updatedAt),
  };
  const vehicleId = optString(row.defaultVehicleId);
  if (vehicleId) mapped.default_vehicle_id = vehicleId;
  return mapped;
}

export function fromPlace(row: typeof savedPlaces.$inferSelect): SavedPlaceRow {
  return {
    id: row.id,
    owner_id: row.ownerId,
    kind: row.kind === 'work' ? 'work' : row.kind === 'favourite' ? 'favourite' : 'home',
    label: row.label,
    lat: row.lat,
    lng: row.lng,
    created_at: iso(row.createdAt),
  };
}

export async function neonListVehicles(db: BrimDb, ownerId: string): Promise<VehicleRow[]> {
  return withRls(db, { ownerId }, async (tx) => {
    const rows = await tx.select().from(vehicles).where(eq(vehicles.ownerId, ownerId));
    return rows.map(fromVehicle);
  });
}

export async function neonGetVehicle(
  db: BrimDb,
  ownerId: string,
  id: string,
): Promise<VehicleRow | undefined> {
  return withRls(db, { ownerId }, async (tx) => {
    const rows = await tx
      .select()
      .from(vehicles)
      .where(and(eq(vehicles.id, id), eq(vehicles.ownerId, ownerId)));
    const row = rows[0];
    return row ? fromVehicle(row) : undefined;
  });
}

export async function neonSaveVehicle(db: BrimDb, row: VehicleRow): Promise<VehicleRow> {
  const values = vehicleValues(row);
  await withRls(db, { ownerId: row.owner_id }, async (tx) => {
    await tx
      .insert(vehicles)
      .values(values)
      .onConflictDoUpdate({
        target: vehicles.id,
        set: {
          nickname: values.nickname,
          kind: values.kind,
          propulsion: values.propulsion,
          make: values.make,
          model: values.model,
          derivative: values.derivative,
          transmission: values.transmission,
          year: values.year,
          engineCc: values.engineCc,
          co2Gkm: values.co2Gkm,
          euroStatus: values.euroStatus,
          euroStatusSource: values.euroStatusSource,
          officialConsumption: values.officialConsumption,
          officialUnit: values.officialUnit,
          officialCycle: values.officialCycle,
          tankLitres: values.tankLitres,
          batteryKwhUsable: values.batteryKwhUsable,
          hasHeatPump: values.hasHeatPump,
          vcaMatchId: values.vcaMatchId,
          vrmHash: values.vrmHash,
          vrmEncrypted: values.vrmEncrypted,
        },
      });
  });
  return row;
}

export async function neonDeleteVehicle(db: BrimDb, ownerId: string, id: string): Promise<boolean> {
  return withRls(db, { ownerId }, async (tx) => {
    const deleted = await tx
      .delete(vehicles)
      .where(and(eq(vehicles.id, id), eq(vehicles.ownerId, ownerId)))
      .returning({ id: vehicles.id });
    return deleted.length > 0;
  });
}

export async function neonListTariffs(
  db: BrimDb,
  ownerId: string,
  vehicleId: string,
): Promise<TariffRow[]> {
  return withRls(db, { ownerId }, async (tx) => {
    const owned = await tx
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(and(eq(vehicles.id, vehicleId), eq(vehicles.ownerId, ownerId)));
    if (!owned[0]) return [];
    const rows = await tx.select().from(tariffs).where(eq(tariffs.vehicleId, vehicleId));
    return rows.map(fromTariff);
  });
}

export async function neonSaveTariff(
  db: BrimDb,
  ownerId: string,
  row: TariffRow,
): Promise<TariffRow | undefined> {
  return withRls(db, { ownerId }, async (tx) => {
    const owned = await tx
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(and(eq(vehicles.id, row.vehicle_id), eq(vehicles.ownerId, ownerId)));
    if (!owned[0]) return undefined;
    if (row.is_default) {
      await tx.update(tariffs).set({ isDefault: false }).where(eq(tariffs.vehicleId, row.vehicle_id));
    }
    const values = tariffValues(row);
    await tx
      .insert(tariffs)
      .values(values)
      .onConflictDoUpdate({
        target: tariffs.id,
        set: {
          kind: values.kind,
          pencePerKwh: values.pencePerKwh,
          offpeakPence: values.offpeakPence,
          offpeakWindow: values.offpeakWindow,
          network: values.network,
          isDefault: values.isDefault,
        },
      });
    return row;
  });
}

export async function neonListJourneys(db: BrimDb, ownerId: string): Promise<JourneyRow[]> {
  return withRls(db, { ownerId }, async (tx) => {
    const rows = await tx
      .select()
      .from(journeys)
      .where(eq(journeys.ownerId, ownerId))
      .orderBy(desc(journeys.createdAt));
    return rows.map(fromJourney);
  });
}

export async function neonGetJourney(
  db: BrimDb,
  ownerId: string,
  id: string,
): Promise<JourneyRow | undefined> {
  return withRls(db, { ownerId }, async (tx) => {
    const rows = await tx
      .select()
      .from(journeys)
      .where(and(eq(journeys.id, id), eq(journeys.ownerId, ownerId)));
    const row = rows[0];
    return row ? fromJourney(row) : undefined;
  });
}

export async function neonSaveJourney(db: BrimDb, row: JourneyRow): Promise<JourneyRow> {
  const values = journeyValues(row);
  await withRls(db, { ownerId: row.owner_id }, async (tx) => {
    await tx
      .insert(journeys)
      .values(values)
      .onConflictDoUpdate({
        target: journeys.id,
        set: {
          vehicleId: values.vehicleId,
          originLabel: values.originLabel,
          destLabel: values.destLabel,
          distanceMeters: values.distanceMeters,
          durationSeconds: values.durationSeconds,
          polyline: values.polyline,
          departsAt: values.departsAt,
          estimateJson: values.estimateJson,
          chargesJson: values.chargesJson,
          isSaved: values.isSaved,
        },
      });
  });
  return row;
}

export async function neonDeleteJourney(db: BrimDb, ownerId: string, id: string): Promise<boolean> {
  return withRls(db, { ownerId }, async (tx) => {
    const deleted = await tx
      .delete(journeys)
      .where(and(eq(journeys.id, id), eq(journeys.ownerId, ownerId)))
      .returning({ id: journeys.id });
    return deleted.length > 0;
  });
}

export async function neonListFillUps(
  db: BrimDb,
  ownerId: string,
  vehicleId: string,
): Promise<FillUpRow[]> {
  return withRls(db, { ownerId }, async (tx) => {
    const owned = await tx
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(and(eq(vehicles.id, vehicleId), eq(vehicles.ownerId, ownerId)));
    if (!owned[0]) return [];
    const rows = await tx
      .select()
      .from(fillUps)
      .where(eq(fillUps.vehicleId, vehicleId))
      .orderBy(desc(fillUps.occurredAt));
    return rows.map(fromFillUp);
  });
}

export async function neonGetFillUp(
  db: BrimDb,
  ownerId: string,
  id: string,
): Promise<FillUpRow | undefined> {
  return withRls(db, { ownerId }, async (tx) => {
    const rows = await tx.select().from(fillUps).where(eq(fillUps.id, id));
    const row = rows[0];
    if (!row) return undefined;
    const owned = await tx
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(and(eq(vehicles.id, row.vehicleId), eq(vehicles.ownerId, ownerId)));
    return owned[0] ? fromFillUp(row) : undefined;
  });
}

export async function neonSaveFillUp(
  db: BrimDb,
  ownerId: string,
  row: FillUpRow,
): Promise<FillUpRow | undefined> {
  return withRls(db, { ownerId }, async (tx) => {
    const owned = await tx
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(and(eq(vehicles.id, row.vehicle_id), eq(vehicles.ownerId, ownerId)));
    if (!owned[0]) return undefined;
    const values = fillUpValues(row);
    await tx
      .insert(fillUps)
      .values(values)
      .onConflictDoUpdate({
        target: fillUps.id,
        set: {
          odometerMiles: values.odometerMiles,
          quantity: values.quantity,
          unit: values.unit,
          pricePence: values.pricePence,
          filledToBrim: values.filledToBrim,
          occurredAt: values.occurredAt,
          note: values.note,
          stationId: values.stationId,
        },
      });
    return row;
  });
}

export async function neonDeleteFillUp(db: BrimDb, ownerId: string, id: string): Promise<boolean> {
  const existing = await neonGetFillUp(db, ownerId, id);
  if (!existing) return false;
  return withRls(db, { ownerId }, async (tx) => {
    const deleted = await tx.delete(fillUps).where(eq(fillUps.id, id)).returning({ id: fillUps.id });
    return deleted.length > 0;
  });
}

export async function neonGetCalibration(
  db: BrimDb,
  ownerId: string,
  vehicleId: string,
): Promise<CalibrationRow | undefined> {
  return withRls(db, { ownerId }, async (tx) => {
    const owned = await tx
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(and(eq(vehicles.id, vehicleId), eq(vehicles.ownerId, ownerId)));
    if (!owned[0]) return undefined;
    const rows = await tx.select().from(calibrations).where(eq(calibrations.vehicleId, vehicleId));
    const row = rows[0];
    return row ? fromCalibration(row) : undefined;
  });
}

export async function neonSaveCalibration(
  db: BrimDb,
  ownerId: string,
  row: CalibrationRow,
): Promise<CalibrationRow | undefined> {
  return withRls(db, { ownerId }, async (tx) => {
    const owned = await tx
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(and(eq(vehicles.id, row.vehicle_id), eq(vehicles.ownerId, ownerId)));
    if (!owned[0]) return undefined;
    await tx.delete(calibrations).where(eq(calibrations.vehicleId, row.vehicle_id));
    await tx.insert(calibrations).values({
      id: row.id,
      vehicleId: row.vehicle_id,
      calculatedValue: row.calculated_value,
      unit: row.unit,
      sampleCount: row.sample_count,
      stddev: row.stddev ?? null,
      lastComputedAt: new Date(row.last_computed_at),
    });
    return row;
  });
}

export async function neonGetSettings(
  db: BrimDb,
  ownerId: string,
): Promise<OwnerSettingsRow | undefined> {
  return withRls(db, { ownerId }, async (tx) => {
    const rows = await tx.select().from(ownerSettings).where(eq(ownerSettings.ownerId, ownerId));
    const row = rows[0];
    return row ? fromSettings(row) : undefined;
  });
}

export async function neonSaveSettings(
  db: BrimDb,
  row: OwnerSettingsRow,
): Promise<OwnerSettingsRow> {
  await withRls(db, { ownerId: row.owner_id }, async (tx) => {
    await tx
      .insert(ownerSettings)
      .values({
        ownerId: row.owner_id,
        defaultVehicleId: row.default_vehicle_id ?? null,
        updatedAt: new Date(row.updated_at),
      })
      .onConflictDoUpdate({
        target: ownerSettings.ownerId,
        set: {
          defaultVehicleId: row.default_vehicle_id ?? null,
          updatedAt: new Date(row.updated_at),
        },
      });
  });
  return row;
}

export async function neonListPlaces(db: BrimDb, ownerId: string): Promise<SavedPlaceRow[]> {
  return withRls(db, { ownerId }, async (tx) => {
    const rows = await tx.select().from(savedPlaces).where(eq(savedPlaces.ownerId, ownerId));
    return rows.map(fromPlace);
  });
}

export async function neonGetPlace(
  db: BrimDb,
  ownerId: string,
  id: string,
): Promise<SavedPlaceRow | undefined> {
  return withRls(db, { ownerId }, async (tx) => {
    const rows = await tx
      .select()
      .from(savedPlaces)
      .where(and(eq(savedPlaces.id, id), eq(savedPlaces.ownerId, ownerId)));
    const row = rows[0];
    return row ? fromPlace(row) : undefined;
  });
}

export async function neonSavePlace(db: BrimDb, row: SavedPlaceRow): Promise<SavedPlaceRow> {
  await withRls(db, { ownerId: row.owner_id }, async (tx) => {
    if (row.kind === 'home' || row.kind === 'work') {
      await tx
        .delete(savedPlaces)
        .where(
          and(
            eq(savedPlaces.ownerId, row.owner_id),
            eq(savedPlaces.kind, row.kind),
          ),
        );
    }
    await tx
      .insert(savedPlaces)
      .values({
        id: row.id,
        ownerId: row.owner_id,
        kind: row.kind,
        label: row.label,
        lat: row.lat,
        lng: row.lng,
        createdAt: new Date(row.created_at),
      })
      .onConflictDoUpdate({
        target: savedPlaces.id,
        set: {
          kind: row.kind,
          label: row.label,
          lat: row.lat,
          lng: row.lng,
        },
      });
  });
  return row;
}

export async function neonDeletePlace(db: BrimDb, ownerId: string, id: string): Promise<boolean> {
  return withRls(db, { ownerId }, async (tx) => {
    const deleted = await tx
      .delete(savedPlaces)
      .where(and(eq(savedPlaces.id, id), eq(savedPlaces.ownerId, ownerId)))
      .returning({ id: savedPlaces.id });
    return deleted.length > 0;
  });
}

export async function neonYtdMiles(
  db: BrimDb,
  ownerId: string,
  taxYearStartIso: string,
  nowIso: string,
): Promise<number> {
  return withRls(db, { ownerId }, async (tx) => {
    const rows = await tx
      .select({ distanceMeters: journeys.distanceMeters })
      .from(journeys)
      .where(
        and(
          eq(journeys.ownerId, ownerId),
          gte(journeys.createdAt, new Date(taxYearStartIso)),
          lte(journeys.createdAt, new Date(nowIso)),
        ),
      );
    return rows.reduce((sum, row) => sum + row.distanceMeters / 1609.344, 0);
  });
}

export async function neonEnsureAnonProfile(db: BrimDb, id: string): Promise<void> {
  await withRls(db, { ownerId: id }, async (tx) => {
    await tx
      .insert(anonProfiles)
      .values({ id, createdAt: new Date() })
      .onConflictDoNothing();
  });
}

export async function neonClaimAnon(
  db: BrimDb,
  anonId: string,
  userId: string,
): Promise<{ merged: boolean; moved: number }> {
  return withRls(db, { serviceRole: true }, async (tx) => {
    const existing = await tx.select().from(anonProfiles).where(eq(anonProfiles.id, anonId));
    const profile = existing[0];
    if (profile?.claimedByUserId) return { merged: false, moved: 0 };

    const userVehicles = await tx.select().from(vehicles).where(eq(vehicles.ownerId, userId));
    const nicknames = new Set(
      userVehicles.flatMap((v) => (v.nickname ? [v.nickname] : [])),
    );
    const anonVehicles = await tx.select().from(vehicles).where(eq(vehicles.ownerId, anonId));
    let moved = 0;
    for (const vehicle of anonVehicles) {
      if (vehicle.nickname && nicknames.has(vehicle.nickname)) {
        await tx.delete(vehicles).where(eq(vehicles.id, vehicle.id));
      } else {
        await tx.update(vehicles).set({ ownerId: userId }).where(eq(vehicles.id, vehicle.id));
        moved += 1;
      }
    }
    const anonJourneys = await tx.select().from(journeys).where(eq(journeys.ownerId, anonId));
    for (const journey of anonJourneys) {
      await tx.update(journeys).set({ ownerId: userId }).where(eq(journeys.id, journey.id));
      moved += 1;
    }

    const userSettings = await tx.select().from(ownerSettings).where(eq(ownerSettings.ownerId, userId));
    const anonSettings = await tx.select().from(ownerSettings).where(eq(ownerSettings.ownerId, anonId));
    if (anonSettings[0]) {
      if (userSettings[0]) {
        if (!userSettings[0].defaultVehicleId && anonSettings[0].defaultVehicleId) {
          await tx
            .update(ownerSettings)
            .set({ defaultVehicleId: anonSettings[0].defaultVehicleId, updatedAt: new Date() })
            .where(eq(ownerSettings.ownerId, userId));
        }
        await tx.delete(ownerSettings).where(eq(ownerSettings.ownerId, anonId));
      } else {
        await tx
          .update(ownerSettings)
          .set({ ownerId: userId, updatedAt: new Date() })
          .where(eq(ownerSettings.ownerId, anonId));
        moved += 1;
      }
    }

    const userPlaces = await tx.select().from(savedPlaces).where(eq(savedPlaces.ownerId, userId));
    const reserved = new Set(
      userPlaces.filter((p) => p.kind === 'home' || p.kind === 'work').map((p) => p.kind),
    );
    const anonPlaces = await tx.select().from(savedPlaces).where(eq(savedPlaces.ownerId, anonId));
    for (const place of anonPlaces) {
      if ((place.kind === 'home' || place.kind === 'work') && reserved.has(place.kind)) {
        await tx.delete(savedPlaces).where(eq(savedPlaces.id, place.id));
      } else {
        await tx.update(savedPlaces).set({ ownerId: userId }).where(eq(savedPlaces.id, place.id));
        moved += 1;
      }
    }

    if (profile) {
      await tx
        .update(anonProfiles)
        .set({ claimedByUserId: userId })
        .where(eq(anonProfiles.id, anonId));
    } else {
      await tx.insert(anonProfiles).values({
        id: anonId,
        createdAt: new Date(),
        claimedByUserId: userId,
      });
    }
    return { merged: true, moved };
  });
}

export async function neonDeleteOwner(db: BrimDb, ownerId: string): Promise<void> {
  await withRls(db, { serviceRole: true }, async (tx) => {
    await tx.delete(vehicles).where(eq(vehicles.ownerId, ownerId));
    await tx.delete(journeys).where(eq(journeys.ownerId, ownerId));
    await tx.delete(savedPlaces).where(eq(savedPlaces.ownerId, ownerId));
    await tx.delete(ownerSettings).where(eq(ownerSettings.ownerId, ownerId));
    await tx.delete(anonProfiles).where(eq(anonProfiles.id, ownerId));
  });
}

export async function neonRouteCacheGet(db: BrimDb, key: string): Promise<string | null> {
  return withRls(db, { serviceRole: true }, async (tx: RlsTx) => {
    const rows = await tx.select().from(routeCache).where(eq(routeCache.cacheKey, key));
    const row = rows[0];
    if (!row || row.expiresAt.getTime() <= Date.now()) return null;
    return JSON.stringify(row.responseJson);
  });
}

export async function neonRouteCachePut(
  db: BrimDb,
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<void> {
  const expiresAt = new Date(Date.now() + Math.max(60, ttlSeconds) * 1000);
  const provider = key.split('|')[0] || 'route';
  const responseJson = JSON.parse(value) as unknown;
  await withRls(db, { serviceRole: true }, async (tx) => {
    await tx
      .insert(routeCache)
      .values({ cacheKey: key, provider, responseJson, expiresAt })
      .onConflictDoUpdate({
        target: routeCache.cacheKey,
        set: { provider, responseJson, expiresAt },
      });
  });
}
