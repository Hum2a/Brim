import type { RouteRequest, RouteResponse, RoutingProvider } from "../types.js";
import { RoutingError } from "../types.js";

export type RecordedRoute = RouteResponse & { id: string; origin: string; destination: string };

const RECORDED: RecordedRoute[] = [
  {
    id: "crawley-london",
    origin: "Crawley",
    destination: "London",
    distanceMeters: 51000,
    durationSeconds: 4200,
    encodedPolyline: "fixture_crawley_london",
    roadComposition: { urban: 0.4, rural: 0.1, motorway: 0.5 },
  },
  {
    id: "manchester-leeds",
    origin: "Manchester",
    destination: "Leeds",
    distanceMeters: 72000,
    durationSeconds: 3600,
    encodedPolyline: "fixture_manchester_leeds",
  },
  {
    id: "birmingham-bristol",
    origin: "Birmingham",
    destination: "Bristol",
    distanceMeters: 145000,
    durationSeconds: 7200,
    encodedPolyline: "fixture_birmingham_bristol",
  },
  {
    id: "edinburgh-glasgow",
    origin: "Edinburgh",
    destination: "Glasgow",
    distanceMeters: 75000,
    durationSeconds: 3900,
    encodedPolyline: "fixture_edinburgh_glasgow",
  },
  {
    id: "cardiff-swansea",
    origin: "Cardiff",
    destination: "Swansea",
    distanceMeters: 67000,
    durationSeconds: 3600,
    encodedPolyline: "fixture_cardiff_swansea",
  },
  {
    id: "newcastle-york",
    origin: "Newcastle",
    destination: "York",
    distanceMeters: 135000,
    durationSeconds: 5400,
    encodedPolyline: "fixture_newcastle_york",
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
    const hit =
      this.routes.find(
        (r) =>
          r.origin.toLowerCase() === req.origin.toLowerCase() &&
          r.destination.toLowerCase() === req.destination.toLowerCase(),
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
