import type { RouteRequest, RouteResponse, RoutingProvider } from "../types.js";
import { RoutingError } from "../types.js";

export type GoogleMode = "basic" | "advanced";

const BASIC_MASK = "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline";
const ADVANCED_MASK = `${BASIC_MASK},routes.travelAdvisory.fuelConsumptionMicroliters,routes.travelAdvisory.tollInfo`;

export class GoogleRoutesProvider implements RoutingProvider {
  readonly name = "google";

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  get capabilities() {
    return {
      tolls: true,
      fuelEstimate: true,
      roadComposition: false,
      alternatives: true,
    };
  }

  async computeRoute(req: RouteRequest): Promise<RouteResponse> {
    const advanced = req.mode === "advanced";
    const body: Record<string, unknown> = {
      origin: { address: req.origin },
      destination: { address: req.destination },
      travelMode: "DRIVE",
      computeAlternativeRoutes: false,
    };
    if (advanced) {
      body.routingPreference = "TRAFFIC_AWARE_OPTIMAL";
      body.extraComputations = ["FUEL_CONSUMPTION", "TOLLS"];
      if (req.emissionType) {
        body.routeModifiers = { vehicleInfo: { emissionType: req.emissionType } };
      }
    }
    const res = await this.fetchImpl("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": advanced ? ADVANCED_MASK : BASIC_MASK,
      },
      body: JSON.stringify(body),
    });
    if (res.status === 401 || res.status === 403) throw new RoutingError("auth", "Google auth failed");
    if (res.status === 429) throw new RoutingError("quota", "Google quota exceeded");
    if (res.status === 400) throw new RoutingError("invalid-request", "Google rejected the request");
    if (!res.ok) throw new RoutingError("upstream", `Google ${res.status}`);
    const json = (await res.json()) as {
      routes?: Array<{
        distanceMeters?: number;
        duration?: string;
        polyline?: { encodedPolyline?: string };
        travelAdvisory?: { fuelConsumptionMicroliters?: string };
      }>;
    };
    const route = json.routes?.[0];
    if (!route?.distanceMeters || !route.polyline?.encodedPolyline) {
      throw new RoutingError("upstream", "Google returned an empty route");
    }
    const durationSeconds = Number.parseFloat((route.duration ?? "0s").replace("s", ""));
    const microlitres = route.travelAdvisory?.fuelConsumptionMicroliters;
    const response: RouteResponse = {
      distanceMeters: route.distanceMeters,
      durationSeconds,
      encodedPolyline: route.polyline.encodedPolyline,
    };
    if (microlitres) response.providerFuelLitres = Number(microlitres) / 1_000_000;
    return response;
  }
}

export const GOOGLE_FIELD_MASKS = { basic: BASIC_MASK, advanced: ADVANCED_MASK };
