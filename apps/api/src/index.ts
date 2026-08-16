import { cors } from 'hono/cors';
import { Hono } from 'hono';
import { isFixtureMode } from '@brim/shared';
import type { ApiBindings } from './env.js';
import { allowedWebOrigin } from './auth.js';
import { cacheStats, handleEstimate, handleFromMapsUrl } from './estimate.js';
import { handlePlaceResolve, handlePlaceReverse, handlePlaces } from './places.js';
import {
  betterAuthHandler,
  claimAnonHandler,
  deleteAccountHandler,
  exportAccountHandler,
  sessionHandler,
} from './account.js';
import {
  createTariffHandler,
  createVehicleHandler,
  deleteVehicleHandler,
  listTariffsHandler,
  listVehiclesHandler,
  patchVehicleHandler,
} from './vehicles.js';
import {
  getCatalogueHandler,
  listCatalogueHandler,
  listMakesHandler,
  listModelsHandler,
} from './catalogue.js';
import {
  createFillUpHandler,
  deleteFillUpHandler,
  getCalibrationHandler,
  listFillUpsHandler,
} from './fill-ups.js';
import {
  createPlaceHandler,
  deletePlaceHandler,
  listPlacesHandler,
  patchPlaceHandler,
} from './places-saved.js';
import { getSettingsHandler, patchSettingsHandler } from './settings.js';
import {
  deleteJourneyHandler,
  exportJourneysHandler,
  getJourneyHandler,
  journeySummaryHandler,
  listJourneysHandler,
  saveJourneyHandler,
} from './journeys.js';
import { handleMetaPrices, handleStationsNear, handleStationsNearRoute } from './stations.js';
import { handleMetaEvTariffs } from './ev.js';
import { handleChargesForRoute, handleVehicleCompliance, handleZones } from './charges.js';

const app = new Hono<{ Bindings: ApiBindings }>();

app.use('*', (c, next) =>
  cors({
    origin: (origin) => allowedWebOrigin(origin, c.env.WEB_ORIGIN),
    credentials: true,
  })(c, next),
);

app.get('/health', (c) => {
  const fixtureMode = isFixtureMode(c.env.BRIM_FIXTURES);
  return c.json({
    status: 'ok',
    version: '0.0.0',
    commit: c.env.COMMIT_SHA ?? 'dev',
    fixtureMode,
    provider: fixtureMode ? 'fixture' : 'live',
    cache: cacheStats(),
  });
});

app.get('/v1/places', handlePlaces);
app.post('/v1/places/resolve', handlePlaceResolve);
app.post('/v1/places/reverse', handlePlaceReverse);
app.post('/v1/estimate', handleEstimate);
app.post('/v1/estimate/from-maps-url', handleFromMapsUrl);
app.get('/v1/stations/near', handleStationsNear);
app.get('/v1/stations/near-route', handleStationsNearRoute);
app.post('/v1/stations/near-route', handleStationsNearRoute);
app.get('/v1/meta/prices', handleMetaPrices);
app.get('/v1/meta/ev-tariffs', handleMetaEvTariffs);
app.get('/v1/zones', handleZones);
app.get('/v1/charges/for-route', handleChargesForRoute);
app.post('/v1/charges/for-route', handleChargesForRoute);

app.get('/v1/auth/session', sessionHandler);
app.post('/v1/auth/claim-anon', claimAnonHandler);
app.get('/v1/auth/export', exportAccountHandler);
app.delete('/v1/auth/account', deleteAccountHandler);
app.on(['GET', 'POST'], '/v1/auth/*', betterAuthHandler);

app.get('/v1/vehicles/catalogue/makes', listMakesHandler);
app.get('/v1/vehicles/catalogue/models', listModelsHandler);
app.get('/v1/vehicles/catalogue', listCatalogueHandler);
app.get('/v1/vehicles/catalogue/:id', getCatalogueHandler);
app.get('/v1/vehicles', listVehiclesHandler);
app.post('/v1/vehicles', createVehicleHandler);
app.patch('/v1/vehicles/:id', patchVehicleHandler);
app.delete('/v1/vehicles/:id', deleteVehicleHandler);
app.get('/v1/vehicles/:id/compliance', handleVehicleCompliance);
app.get('/v1/vehicles/:id/tariffs', listTariffsHandler);
app.post('/v1/vehicles/:id/tariffs', createTariffHandler);
app.get('/v1/vehicles/:id/fill-ups', listFillUpsHandler);
app.get('/v1/vehicles/:id/calibration', getCalibrationHandler);

app.get('/v1/settings', getSettingsHandler);
app.patch('/v1/settings', patchSettingsHandler);
app.get('/v1/saved-places', listPlacesHandler);
app.post('/v1/saved-places', createPlaceHandler);
app.patch('/v1/saved-places/:id', patchPlaceHandler);
app.delete('/v1/saved-places/:id', deletePlaceHandler);

app.post('/v1/fill-ups', createFillUpHandler);
app.delete('/v1/fill-ups/:id', deleteFillUpHandler);

app.post('/v1/journeys', saveJourneyHandler);
app.get('/v1/journeys', listJourneysHandler);
app.get('/v1/journeys/export', exportJourneysHandler);
app.get('/v1/journeys/summary', journeySummaryHandler);
app.get('/v1/journeys/:id', getJourneyHandler);
app.delete('/v1/journeys/:id', deleteJourneyHandler);

export default app;
export type { ApiBindings } from './env.js';
