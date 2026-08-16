import {
  findPlaceById,
  reverseGazetteer,
  searchPlaces,
  UK_PLACES,
  type PlaceHit,
} from "@brim/shared";
import type { AutocompleteOpts, GeocodeHit, Geocoder, PlaceSuggestion } from "./types.js";

function toSuggestion(p: PlaceHit): PlaceSuggestion {
  const hit: PlaceSuggestion = { label: p.label, lat: p.lat, lng: p.lng };
  if (p.placeId) hit.placeId = p.placeId;
  return hit;
}

function toHit(p: PlaceHit): GeocodeHit {
  const hit: GeocodeHit = { label: p.label, lat: p.lat, lng: p.lng };
  if (p.placeId) hit.placeId = p.placeId;
  return hit;
}

export class FixtureGeocoder implements Geocoder {
  constructor(private readonly places: PlaceHit[] = UK_PLACES) {}

  async autocomplete(query: string, _opts?: AutocompleteOpts): Promise<PlaceSuggestion[]> {
    if (query.trim().length < 2) return [];
    return searchPlaces(query, this.places).map(toSuggestion);
  }

  async resolve(placeId: string, _opts?: { session?: string }): Promise<GeocodeHit | undefined> {
    const hit = findPlaceById(placeId, this.places);
    return hit ? toHit(hit) : undefined;
  }

  async reverse(lat: number, lng: number): Promise<GeocodeHit | undefined> {
    return toHit(reverseGazetteer(lat, lng, this.places));
  }

  async snap(lat: number, lng: number): Promise<{ lat: number; lng: number }> {
    const named = reverseGazetteer(lat, lng, this.places);
    return { lat: named.lat, lng: named.lng };
  }
}
