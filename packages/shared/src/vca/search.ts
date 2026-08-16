import type { CatalogueVehicle } from "./types.js";
import { vcaToCatalogue } from "./normalise.js";
import type { VcaVehicle } from "./types.js";

const CATALOGUE_LIMIT = 20;
const MIN_QUERY = 2;

function haystack(v: VcaVehicle): string {
  return `${v.make} ${v.model} ${v.derivative ?? ""} ${v.fuel} ${v.transmission ?? ""}`.toLowerCase();
}

function score(v: VcaVehicle, needle: string): number {
  const make = v.make.toLowerCase();
  const model = v.model.toLowerCase();
  if (make.startsWith(needle)) return 0;
  if (model.startsWith(needle)) return 1;
  if (`${make} ${model}`.startsWith(needle)) return 2;
  if (haystack(v).includes(needle)) return 3;
  return 99;
}

export function searchVcaCatalogue(
  vehicles: readonly VcaVehicle[],
  q: string,
  limit = CATALOGUE_LIMIT,
): CatalogueVehicle[] {
  const needle = q.trim().toLowerCase();
  if (needle.length < MIN_QUERY) return [];
  return vehicles
    .map((v) => ({ v, s: score(v, needle) }))
    .filter((x) => x.s < 99)
    .sort((a, b) => a.s - b.s || a.v.make.localeCompare(b.v.make) || a.v.model.localeCompare(b.v.model))
    .slice(0, limit)
    .map((x) => vcaToCatalogue(x.v));
}

export function getVcaById(vehicles: readonly VcaVehicle[], id: string): CatalogueVehicle | undefined {
  const hit = vehicles.find((v) => v.id === id);
  return hit ? vcaToCatalogue(hit) : undefined;
}

export { CATALOGUE_LIMIT, MIN_QUERY };
