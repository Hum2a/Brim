import type { RouteRequest, RouteResponse, RoutingProvider } from "../types.js";
import { RoutingError } from "../types.js";
import { osrmCoord } from "../place.js";

export class OsrmProvider implements RoutingProvider {
  readonly name = "osrm";
  readonly capabilities = {
    tolls: false,
    fuelEstimate: false,
    roadComposition: false,
    alternatives: true,
  } as const;

  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async computeRoute(req: RouteRequest): Promise<RouteResponse> {
    const points = [req.origin, ...(req.waypoints ?? []), req.destination].map(osrmCoord);
    const path = points.join(";");
    const url = `${this.baseUrl.replace(/\/$/, "")}/route/v1/driving/${path}?overview=full&geometries=polyline`;
    const res = await this.fetchImpl(url);
    if (!res.ok) {
      throw new RoutingError("upstream", `OSRM ${res.status}`);
    }
    const body = (await res.json()) as {
      routes?: Array<{ distance: number; duration: number; geometry: string }>;
    };
    const route = body.routes?.[0];
    if (!route) throw new RoutingError("invalid-request", "OSRM returned no route");
    return {
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      encodedPolyline: route.geometry,
    };
  }
}
