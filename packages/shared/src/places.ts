export type PlaceHit = {
  label: string;
  lat: number;
  lng: number;
};

export const UK_PLACES: PlaceHit[] = [
  { label: "Crawley", lat: 51.1092, lng: -0.1872 },
  { label: "London", lat: 51.5074, lng: -0.1278 },
  { label: "Manchester", lat: 53.4808, lng: -2.2426 },
  { label: "Leeds", lat: 53.8008, lng: -1.5491 },
  { label: "Birmingham", lat: 52.4862, lng: -1.8904 },
  { label: "Bristol", lat: 51.4545, lng: -2.5879 },
  { label: "Edinburgh", lat: 55.9533, lng: -3.1883 },
  { label: "Glasgow", lat: 55.8642, lng: -4.2518 },
  { label: "Cardiff", lat: 51.4816, lng: -3.1791 },
  { label: "Swansea", lat: 51.6214, lng: -3.9436 },
  { label: "Newcastle", lat: 54.9783, lng: -1.6178 },
  { label: "York", lat: 53.96, lng: -1.0873 },
];

export function searchPlaces(query: string, places: PlaceHit[] = UK_PLACES): PlaceHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 1) return places.slice(0, 8);
  return places.filter((p) => p.label.toLowerCase().includes(q)).slice(0, 8);
}
