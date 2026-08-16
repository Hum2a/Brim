export type RoutingCapabilities = {
  tolls: boolean;
  fuelEstimate: boolean;
  roadComposition: boolean;
  alternatives: boolean;
};

export type RoutePlace =
  | string
  | {
      lat: number;
      lng: number;
      label?: string;
    };

export type RouteRequest = {
  origin: RoutePlace;
  destination: RoutePlace;
  waypoints?: RoutePlace[] | undefined;
  mode: "basic" | "advanced";
  departureTime?: string | undefined;
  emissionType?: "GASOLINE" | "DIESEL" | "HYBRID" | "ELECTRIC" | undefined;
};

export type RouteResponse = {
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
  providerFuelLitres?: number;
  roadComposition?: { urban: number; rural: number; motorway: number };
};

export type RoutingErrorCode = "quota" | "auth" | "invalid-request" | "upstream";

export class RoutingError extends Error {
  constructor(
    readonly code: RoutingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RoutingError";
  }
}

export interface RoutingProvider {
  readonly name: string;
  readonly capabilities: RoutingCapabilities;
  computeRoute(req: RouteRequest): Promise<RouteResponse>;
}
