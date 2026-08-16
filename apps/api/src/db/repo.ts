import { isFixtureMode } from '@brim/shared';
import { getMemoryDb, type JourneyRow, type TariffRow, type VehicleRow } from './memory.js';
import {
  neonClaimAnon,
  neonDeleteJourney,
  neonDeleteOwner,
  neonDeleteVehicle,
  neonEnsureAnonProfile,
  neonGetJourney,
  neonGetVehicle,
  neonListJourneys,
  neonListTariffs,
  neonListVehicles,
  neonSaveJourney,
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
  profile.claimed_by_user_id = userId;
  return { merged: true, moved };
}

export async function exportOwner(db: BrimDb, ownerId: string) {
  const owned = await listVehicles(db, ownerId);
  return {
    vehicles: owned,
    journeys: await listJourneys(db, ownerId),
    tariffs: (
      await Promise.all(owned.map((v) => listTariffs(db, ownerId, v.id)))
    ).flat(),
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
  memory.anon.delete(ownerId);
  memory.users.delete(ownerId);
}
