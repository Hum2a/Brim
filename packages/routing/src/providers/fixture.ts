import { encodePolyline, UK_PLACES } from "@brim/shared";
import type { RouteRequest, RouteResponse, RoutingProvider } from "../types.js";
import { RoutingError } from "../types.js";
import { fixturePlaceKey } from "../place.js";

export type RecordedRoute = RouteResponse & { id: string; origin: string; destination: string };

function place(label: string) {
  const hit = UK_PLACES.find((p) => p.label === label);
  if (!hit) throw new Error(`missing fixture place ${label}`);
  return hit;
}

function line(origin: string, destination: string): string {
  const a = place(origin);
  const b = place(destination);
  return encodePolyline([
    { lat: a.lat, lng: a.lng },
    { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 },
    { lat: b.lat, lng: b.lng },
  ]);
}

const RECORDED: RecordedRoute[] = [
  {
    id: "crawley-london",
    origin: "Crawley",
    destination: "London",
    distanceMeters: 51000,
    durationSeconds: 4200,
    encodedPolyline: line("Crawley", "London"),
    roadComposition: { urban: 0.4, rural: 0.1, motorway: 0.5 },
  },
  {
    id: "manchester-leeds",
    origin: "Manchester",
    destination: "Leeds",
    distanceMeters: 72000,
    durationSeconds: 3600,
    encodedPolyline: line("Manchester", "Leeds"),
  },
  {
    id: "birmingham-bristol",
    origin: "Birmingham",
    destination: "Bristol",
    distanceMeters: 145000,
    durationSeconds: 7200,
    encodedPolyline: line("Birmingham", "Bristol"),
  },
  {
    id: "edinburgh-glasgow",
    origin: "Edinburgh",
    destination: "Glasgow",
    distanceMeters: 75000,
    durationSeconds: 3900,
    encodedPolyline: line("Edinburgh", "Glasgow"),
  },
  {
    id: "cardiff-swansea",
    origin: "Cardiff",
    destination: "Swansea",
    distanceMeters: 67000,
    durationSeconds: 3600,
    encodedPolyline: line("Cardiff", "Swansea"),
  },
  {
    id: "newcastle-york",
    origin: "Newcastle",
    destination: "York",
    distanceMeters: 135000,
    durationSeconds: 5400,
    encodedPolyline: line("Newcastle", "York"),
  },
];

export class FixtureProvider implements RoutingProvider {
  readonly name = "fixture";
  readonly capabilities = {
    tolls: false,
    fuelEstimate: true,
    roadComposition: true,
    alternatives: false,
  };

  constructor(private readonly routes: RecordedRoute[] = RECORDED) {}

  async computeRoute(req: RouteRequest): Promise<RouteResponse> {
    const originKey = fixturePlaceKey(req.origin);
    const destKey = fixturePlaceKey(req.destination);
    const hit =
      this.routes.find(
        (r) => r.origin.toLowerCase() === originKey && r.destination.toLowerCase() === destKey,
      ) ?? this.routes[0];
    if (!hit) throw new RoutingError("invalid-request", "no fixture routes");
    const fuel = req.mode === "advanced" ? (hit.distanceMeters / 1000 / 100) * 7.5 : undefined;
    const response: RouteResponse = {
      distanceMeters: hit.distanceMeters,
      durationSeconds: hit.durationSeconds,
      encodedPolyline: hit.encodedPolyline,
    };
    if (fuel !== undefined) response.providerFuelLitres = fuel;
    if (hit.roadComposition) response.roadComposition = hit.roadComposition;
    return response;
  }
}

export const UK_FIXTURE_ROUTES = RECORDED;
