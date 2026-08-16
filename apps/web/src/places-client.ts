import { api } from "./api.js";

export type Place = { label: string; lat: number; lng: number; placeId?: string };

export type PlaceSuggestion = {
  label: string;
  placeId?: string;
  lat?: number;
  lng?: number;
};

export function newPlaceSession(): string {
  return crypto.randomUUID();
}

export async function fetchPlaceSuggestions(
  q: string,
  session: string,
): Promise<PlaceSuggestion[]> {
  if (q.trim().length < 2) return [];
  const res = await api<{ places: PlaceSuggestion[] }>(
    `/v1/places?q=${encodeURIComponent(q.trim())}&session=${encodeURIComponent(session)}`,
  );
  return res.places;
}

export async function resolvePlaceSuggestion(
  hit: PlaceSuggestion,
  session: string,
): Promise<Place | undefined> {
  if (hit.lat !== undefined && hit.lng !== undefined) {
    const place: Place = { label: hit.label, lat: hit.lat, lng: hit.lng };
    if (hit.placeId) place.placeId = hit.placeId;
    return place;
  }
  if (!hit.placeId) return undefined;
  const res = await api<{ place: Place }>("/v1/places/resolve", {
    method: "POST",
    body: JSON.stringify({ placeId: hit.placeId, session }),
  });
  return res.place;
}

export async function reversePlace(lat: number, lng: number): Promise<Place> {
  const res = await api<{ place: Place }>("/v1/places/reverse", {
    method: "POST",
    body: JSON.stringify({ lat, lng }),
  });
  return res.place;
}
