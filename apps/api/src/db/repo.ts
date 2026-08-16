import { isFixtureMode } from '@brim/shared';
import {
  getMemoryDb,
  type CalibrationRow,
  type FillUpRow,
  type JourneyRow,
  type OwnerSettingsRow,
  type SavedPlaceRow,
  type TariffRow,
  type VehicleRow,
} from './memory.js';
import {
  neonClaimAnon,
  neonDeleteFillUp,
  neonDeleteJourney,
  neonDeleteOwner,
  neonDeletePlace,
  neonDeleteVehicle,
  neonEnsureAnonProfile,
  neonGetCalibration,
  neonGetFillUp,
  neonGetJourney,
  neonGetPlace,
  neonGetSettings,
  neonGetVehicle,
  neonListFillUps,
  neonListJourneys,
  neonListPlaces,
  neonListTariffs,
  neonListVehicles,
  neonSaveCalibration,
  neonSaveFillUp,
  neonSaveJourney,
  neonSavePlace,
  neonSaveSettings,
  neonSaveTariff,
  neonSaveVehicle,
  neonYtdMiles,
} from './neon-repo.js';
import type { BrimDb } from './types.js';

export type { BrimDb } from './types.js';

export function persistLive(db: BrimDb): boolean {
  return !isFixtureMode(db.env.BRIM_FIXTURES) && Boolean(db.connectionString);
}

export async function listVehicles(db: BrimDb, ownerId: string): Promise<VehicleRow[]> {
  if (persistLive(db)) return neonListVehicles(db, ownerId);
  return [...getMemoryDb().vehicles.values()].filter((v) => v.owner_id === ownerId);
}

export async function getVehicle(
  db: BrimDb,
  ownerId: string,
  id: string,
): Promise<VehicleRow | undefined> {
  if (persistLive(db)) return neonGetVehicle(db, ownerId, id);
  const row = getMemoryDb().vehicles.get(id);
  return row?.owner_id === ownerId ? row : undefined;
}

export async function saveVehicle(db: BrimDb, row: VehicleRow): Promise<VehicleRow> {
  if (persistLive(db)) return neonSaveVehicle(db, row);
  getMemoryDb().vehicles.set(row.id, row);
  return row;
}

export async function deleteVehicle(db: BrimDb, ownerId: string, id: string): Promise<boolean> {
  if (persistLive(db)) return neonDeleteVehicle(db, ownerId, id);
  const existing = await getVehicle(db, ownerId, id);
  if (!existing) return false;
  getMemoryDb().vehicles.delete(id);
  for (const [tid, t] of getMemoryDb().tariffs) {
    if (t.vehicle_id === id) getMemoryDb().tariffs.delete(tid);
  }
  for (const [fid, f] of getMemoryDb().fillUps) {
    if (f.vehicle_id === id) getMemoryDb().fillUps.delete(fid);
  }
  for (const [cid, c] of getMemoryDb().calibrations) {
    if (c.vehicle_id === id) getMemoryDb().calibrations.delete(cid);
  }
  for (const s of getMemoryDb().settings.values()) {
    if (s.default_vehicle_id === id) delete s.default_vehicle_id;
  }
  return true;
}

export async function listTariffs(
  db: BrimDb,
  ownerId: string,
  vehicleId: string,
): Promise<TariffRow[]> {
  if (persistLive(db)) return neonListTariffs(db, ownerId, vehicleId);
  if (!(await getVehicle(db, ownerId, vehicleId))) return [];
  return [...getMemoryDb().tariffs.values()].filter((t) => t.vehicle_id === vehicleId);
}

export async function saveTariff(
  db: BrimDb,
  ownerId: string,
  row: TariffRow,
): Promise<TariffRow | undefined> {
  if (persistLive(db)) return neonSaveTariff(db, ownerId, row);
  if (!(await getVehicle(db, ownerId, row.vehicle_id))) return undefined;
  if (row.is_default) {
    for (const t of getMemoryDb().tariffs.values()) {
      if (t.vehicle_id === row.vehicle_id) t.is_default = false;
    }
  }
  getMemoryDb().tariffs.set(row.id, row);
  return row;
}

export async function getDefaultTariff(
  db: BrimDb,
  ownerId: string,
  vehicleId: string,
): Promise<TariffRow | undefined> {
  const all = await listTariffs(db, ownerId, vehicleId);
  return all.find((t) => t.is_default) ?? all[0];
}

export async function listJourneys(db: BrimDb, ownerId: string): Promise<JourneyRow[]> {
  if (persistLive(db)) return neonListJourneys(db, ownerId);
  return [...getMemoryDb().journeys.values()]
    .filter((j) => j.owner_id === ownerId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function getJourney(
  db: BrimDb,
  ownerId: string,
  id: string,
): Promise<JourneyRow | undefined> {
  if (persistLive(db)) return neonGetJourney(db, ownerId, id);
  const row = getMemoryDb().journeys.get(id);
  return row?.owner_id === ownerId ? row : undefined;
}

export async function saveJourney(db: BrimDb, row: JourneyRow): Promise<JourneyRow> {
  if (persistLive(db)) return neonSaveJourney(db, row);
  getMemoryDb().journeys.set(row.id, row);
  return row;
}

export async function deleteJourney(db: BrimDb, ownerId: string, id: string): Promise<boolean> {
  if (persistLive(db)) return neonDeleteJourney(db, ownerId, id);
  const existing = await getJourney(db, ownerId, id);
  if (!existing) return false;
  getMemoryDb().journeys.delete(id);
  return true;
}

export async function ytdMiles(
  db: BrimDb,
  ownerId: string,
  taxYearStartIso: string,
  nowIso: string,
): Promise<number> {
  if (persistLive(db)) return neonYtdMiles(db, ownerId, taxYearStartIso, nowIso);
  return (await listJourneys(db, ownerId))
    .filter((j) => j.created_at >= taxYearStartIso && j.created_at <= nowIso)
    .reduce((sum, j) => sum + j.distance_meters / 1609.344, 0);
}

export async function listFillUps(
  db: BrimDb,
  ownerId: string,
  vehicleId: string,
): Promise<FillUpRow[]> {
  if (persistLive(db)) return neonListFillUps(db, ownerId, vehicleId);
  if (!(await getVehicle(db, ownerId, vehicleId))) return [];
  return [...getMemoryDb().fillUps.values()]
    .filter((f) => f.vehicle_id === vehicleId)
    .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));
}

export async function getFillUp(
  db: BrimDb,
  ownerId: string,
  id: string,
): Promise<FillUpRow | undefined> {
  if (persistLive(db)) return neonGetFillUp(db, ownerId, id);
  const row = getMemoryDb().fillUps.get(id);
  if (!row) return undefined;
  if (!(await getVehicle(db, ownerId, row.vehicle_id))) return undefined;
  return row;
}

export async function saveFillUp(
  db: BrimDb,
  ownerId: string,
  row: FillUpRow,
): Promise<FillUpRow | undefined> {
  if (persistLive(db)) return neonSaveFillUp(db, ownerId, row);
  if (!(await getVehicle(db, ownerId, row.vehicle_id))) return undefined;
  getMemoryDb().fillUps.set(row.id, row);
  return row;
}

export async function deleteFillUp(db: BrimDb, ownerId: string, id: string): Promise<boolean> {
  if (persistLive(db)) return neonDeleteFillUp(db, ownerId, id);
  const existing = await getFillUp(db, ownerId, id);
  if (!existing) return false;
  getMemoryDb().fillUps.delete(id);
  return true;
}

export async function getCalibration(
  db: BrimDb,
  ownerId: string,
  vehicleId: string,
): Promise<CalibrationRow | undefined> {
  if (persistLive(db)) return neonGetCalibration(db, ownerId, vehicleId);
  if (!(await getVehicle(db, ownerId, vehicleId))) return undefined;
  return [...getMemoryDb().calibrations.values()].find((c) => c.vehicle_id === vehicleId);
}

export async function saveCalibration(
  db: BrimDb,
  ownerId: string,
  row: CalibrationRow,
): Promise<CalibrationRow | undefined> {
  if (persistLive(db)) return neonSaveCalibration(db, ownerId, row);
  if (!(await getVehicle(db, ownerId, row.vehicle_id))) return undefined;
  for (const [id, c] of getMemoryDb().calibrations) {
    if (c.vehicle_id === row.vehicle_id) getMemoryDb().calibrations.delete(id);
  }
  getMemoryDb().calibrations.set(row.id, row);
  return row;
}

export async function getSettings(
  db: BrimDb,
  ownerId: string,
): Promise<OwnerSettingsRow | undefined> {
  if (persistLive(db)) return neonGetSettings(db, ownerId);
  return getMemoryDb().settings.get(ownerId);
}

export async function saveSettings(db: BrimDb, row: OwnerSettingsRow): Promise<OwnerSettingsRow> {
  if (persistLive(db)) return neonSaveSettings(db, row);
  getMemoryDb().settings.set(row.owner_id, row);
  return row;
}

export async function listPlaces(db: BrimDb, ownerId: string): Promise<SavedPlaceRow[]> {
  if (persistLive(db)) return neonListPlaces(db, ownerId);
  return [...getMemoryDb().places.values()].filter((p) => p.owner_id === ownerId);
}

export async function getPlace(
  db: BrimDb,
  ownerId: string,
  id: string,
): Promise<SavedPlaceRow | undefined> {
  if (persistLive(db)) return neonGetPlace(db, ownerId, id);
  const row = getMemoryDb().places.get(id);
  return row?.owner_id === ownerId ? row : undefined;
}

export async function savePlace(db: BrimDb, row: SavedPlaceRow): Promise<SavedPlaceRow> {
  if (persistLive(db)) return neonSavePlace(db, row);
  if (row.kind === 'home' || row.kind === 'work') {
    for (const [id, p] of getMemoryDb().places) {
      if (p.owner_id === row.owner_id && p.kind === row.kind && p.id !== row.id) {
        getMemoryDb().places.delete(id);
      }
    }
  }
  getMemoryDb().places.set(row.id, row);
  return row;
}

export async function deletePlace(db: BrimDb, ownerId: string, id: string): Promise<boolean> {
  if (persistLive(db)) return neonDeletePlace(db, ownerId, id);
  const existing = await getPlace(db, ownerId, id);
  if (!existing) return false;
  getMemoryDb().places.delete(id);
  return true;
}

export async function ensureAnonProfile(db: BrimDb, id: string): Promise<void> {
  if (persistLive(db)) {
    await neonEnsureAnonProfile(db, id);
    return;
  }
  const memory = getMemoryDb();
  if (!memory.anon.has(id)) {
    memory.anon.set(id, { id, created_at: new Date().toISOString() });
  }
}

export async function claimAnon(
  db: BrimDb,
  anonId: string,
  userId: string,
): Promise<{ merged: boolean; moved: number }> {
  if (persistLive(db)) return neonClaimAnon(db, anonId, userId);
  const memory = getMemoryDb();
  const profile = memory.anon.get(anonId) ?? { id: anonId, created_at: new Date().toISOString() };
  if (profile.claimed_by_user_id) return { merged: false, moved: 0 };
  memory.anon.set(anonId, profile);
  let moved = 0;
  for (const v of memory.vehicles.values()) {
    if (v.owner_id === anonId) {
      const clash = [...memory.vehicles.values()].find(
        (o) => o.owner_id === userId && o.nickname && o.nickname === v.nickname,
      );
      if (clash) {
        memory.vehicles.delete(v.id);
      } else {
        v.owner_id = userId;
        moved += 1;
      }
    }
  }
  for (const j of memory.journeys.values()) {
    if (j.owner_id === anonId) {
      j.owner_id = userId;
      moved += 1;
    }
  }
  const userSettings = memory.settings.get(userId);
  const anonSettings = memory.settings.get(anonId);
  if (anonSettings) {
    if (userSettings) {
      if (!userSettings.default_vehicle_id && anonSettings.default_vehicle_id) {
        userSettings.default_vehicle_id = anonSettings.default_vehicle_id;
      }
      memory.settings.delete(anonId);
    } else {
      anonSettings.owner_id = userId;
      memory.settings.set(userId, anonSettings);
      memory.settings.delete(anonId);
      moved += 1;
    }
  }
  const reserved = new Set(
    [...memory.places.values()]
      .filter((p) => p.owner_id === userId && (p.kind === 'home' || p.kind === 'work'))
      .map((p) => p.kind),
  );
  for (const p of [...memory.places.values()]) {
    if (p.owner_id !== anonId) continue;
    if ((p.kind === 'home' || p.kind === 'work') && reserved.has(p.kind)) {
      memory.places.delete(p.id);
    } else {
      p.owner_id = userId;
      moved += 1;
    }
  }
  profile.claimed_by_user_id = userId;
  return { merged: true, moved };
}

export async function exportOwner(db: BrimDb, ownerId: string) {
  const owned = await listVehicles(db, ownerId);
  return {
    vehicles: owned,
    journeys: await listJourneys(db, ownerId),
    tariffs: (await Promise.all(owned.map((v) => listTariffs(db, ownerId, v.id)))).flat(),
    fillUps: (await Promise.all(owned.map((v) => listFillUps(db, ownerId, v.id)))).flat(),
    calibrations: (
      await Promise.all(owned.map((v) => getCalibration(db, ownerId, v.id)))
    ).filter((row): row is CalibrationRow => Boolean(row)),
    settings: (await getSettings(db, ownerId)) ?? null,
    places: await listPlaces(db, ownerId),
  };
}

export async function deleteOwner(db: BrimDb, ownerId: string): Promise<void> {
  if (persistLive(db)) {
    await neonDeleteOwner(db, ownerId);
    return;
  }
  const memory = getMemoryDb();
  for (const v of [...memory.vehicles.values()]) {
    if (v.owner_id === ownerId) await deleteVehicle(db, ownerId, v.id);
  }
  for (const j of [...memory.journeys.values()]) {
    if (j.owner_id === ownerId) memory.journeys.delete(j.id);
  }
  for (const p of [...memory.places.values()]) {
    if (p.owner_id === ownerId) memory.places.delete(p.id);
  }
  memory.settings.delete(ownerId);
  memory.anon.delete(ownerId);
  memory.users.delete(ownerId);
}
