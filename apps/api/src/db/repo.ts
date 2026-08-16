import { getMemoryDb, type JourneyRow, type TariffRow, type VehicleRow } from "./memory.js";

export function listVehicles(ownerId: string): VehicleRow[] {
  return [...getMemoryDb().vehicles.values()].filter((v) => v.owner_id === ownerId);
}

export function getVehicle(ownerId: string, id: string): VehicleRow | undefined {
  const row = getMemoryDb().vehicles.get(id);
  return row?.owner_id === ownerId ? row : undefined;
}

export function saveVehicle(row: VehicleRow): VehicleRow {
  getMemoryDb().vehicles.set(row.id, row);
  return row;
}

export function deleteVehicle(ownerId: string, id: string): boolean {
  const existing = getVehicle(ownerId, id);
  if (!existing) return false;
  getMemoryDb().vehicles.delete(id);
  for (const [tid, t] of getMemoryDb().tariffs) {
    if (t.vehicle_id === id) getMemoryDb().tariffs.delete(tid);
  }
  return true;
}

export function listTariffs(ownerId: string, vehicleId: string): TariffRow[] {
  if (!getVehicle(ownerId, vehicleId)) return [];
  return [...getMemoryDb().tariffs.values()].filter((t) => t.vehicle_id === vehicleId);
}

export function saveTariff(ownerId: string, row: TariffRow): TariffRow | undefined {
  if (!getVehicle(ownerId, row.vehicle_id)) return undefined;
  getMemoryDb().tariffs.set(row.id, row);
  return row;
}

export function listJourneys(ownerId: string): JourneyRow[] {
  return [...getMemoryDb().journeys.values()]
    .filter((j) => j.owner_id === ownerId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function getJourney(ownerId: string, id: string): JourneyRow | undefined {
  const row = getMemoryDb().journeys.get(id);
  return row?.owner_id === ownerId ? row : undefined;
}

export function saveJourney(row: JourneyRow): JourneyRow {
  getMemoryDb().journeys.set(row.id, row);
  return row;
}

export function deleteJourney(ownerId: string, id: string): boolean {
  const existing = getJourney(ownerId, id);
  if (!existing) return false;
  getMemoryDb().journeys.delete(id);
  return true;
}

export function ytdMiles(ownerId: string, taxYearStartIso: string, nowIso: string): number {
  return listJourneys(ownerId)
    .filter((j) => j.created_at >= taxYearStartIso && j.created_at <= nowIso)
    .reduce((sum, j) => sum + j.distance_meters / 1609.344, 0);
}

export function claimAnon(anonId: string, userId: string): { merged: boolean; moved: number } {
  const db = getMemoryDb();
  const profile = db.anon.get(anonId) ?? { id: anonId, created_at: new Date().toISOString() };
  if (profile.claimed_by_user_id) return { merged: false, moved: 0 };
  db.anon.set(anonId, profile);
  let moved = 0;
  for (const v of db.vehicles.values()) {
    if (v.owner_id === anonId) {
      const clash = [...db.vehicles.values()].find(
        (o) => o.owner_id === userId && o.nickname && o.nickname === v.nickname,
      );
      if (clash) {
        db.vehicles.delete(v.id);
      } else {
        v.owner_id = userId;
        moved += 1;
      }
    }
  }
  for (const j of db.journeys.values()) {
    if (j.owner_id === anonId) {
      j.owner_id = userId;
      moved += 1;
    }
  }
  profile.claimed_by_user_id = userId;
  return { merged: true, moved };
}

export function exportOwner(ownerId: string) {
  return {
    vehicles: listVehicles(ownerId),
    journeys: listJourneys(ownerId),
    tariffs: listVehicles(ownerId).flatMap((v) => listTariffs(ownerId, v.id)),
  };
}

export function deleteOwner(ownerId: string): void {
  const db = getMemoryDb();
  for (const v of [...db.vehicles.values()]) {
    if (v.owner_id === ownerId) deleteVehicle(ownerId, v.id);
  }
  for (const j of [...db.journeys.values()]) {
    if (j.owner_id === ownerId) db.journeys.delete(j.id);
  }
  db.anon.delete(ownerId);
  db.users.delete(ownerId);
}
