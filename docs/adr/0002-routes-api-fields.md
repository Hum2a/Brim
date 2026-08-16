# ADR 0002 — Google Routes API fields

Date checked: 2026-08-15
Source: https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes

## Findings vs spec §6.1

Spec §6.1 is still accurate on the important names:

- Endpoint: `POST https://routes.googleapis.com/directions/v2:computeRoutes`
- `extraComputations`: `FUEL_CONSUMPTION`, `TOLLS` (plus others we will not request)
- Field mask still uses `routes.distanceMeters`, `routes.duration`, `routes.polyline.encodedPolyline`
- Tolls live on `travelAdvisory.tollInfo` (route and/or leg). Extra computation `TOLLS` is required for the field to populate.
- Fuel: extra computation `FUEL_CONSUMPTION`. Spec's `routes.travelAdvisory.fuelConsumptionMicroliters` is the field we will request; if a live response omits it we treat `fuelEstimate` capability as unused rather than guessing.

## Discrepancies / gaps

- The current Route object has **no road-class composition** (urban/rural/motorway fractions). We will report `roadComposition: false` rather than fabricating a breakdown (spec §5.3).
- UK toll coverage is still not guaranteed in the API. Advanced mode may request `TOLLS` for the field, but **P7 owns charge amounts** from our own table. If live UK tolls are empty we drop `TOLLS` from extraComputations to save SKU cost.

## Modes

- `basic`: field mask distance, duration, polyline only. No extraComputations. Cheaper SKU.
- `advanced`: adds `TRAFFIC_AWARE_OPTIMAL`, `FUEL_CONSUMPTION`, `TOLLS`, and the corresponding field mask entries.
