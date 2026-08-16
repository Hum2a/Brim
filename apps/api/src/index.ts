import { cors } from 'hono/cors';
import { Hono } from 'hono';
import { isFixtureMode } from '@brim/shared';
import type { ApiBindings } from './env.js';
import { cacheStats, handleEstimate, handleFromMapsUrl, handlePlaces } from './estimate.js';
import {
  claimAnonHandler,
  deleteAccountHandler,
  exportAccountHandler,
  loginHandler,
  logoutHandler,
  magicLinkHandler,
  resetHandler,
  sessionHandler,
  signupHandler,
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
  deleteJourneyHandler,
  exportJourneysHandler,
  getJourneyHandler,
  listJourneysHandler,
  saveJourneyHandler,
} from './journeys.js';

const app = new Hono<{ Bindings: ApiBindings }>();

const LOCAL_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(
  '*',
  cors({
    origin: (origin) => {
      if (LOCAL_ORIGINS.includes(origin)) return origin;
      if (/^https:\/\/[\w-]+\.brim-web-staging\.pages\.dev$/.test(origin)) return origin;
      if (origin === 'https://brim-web-staging.pages.dev') return origin;
      return LOCAL_ORIGINS[0] ?? 'http://localhost:5173';
    },
    credentials: true,
  }),
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
app.post('/v1/estimate', handleEstimate);
app.post('/v1/estimate/from-maps-url', handleFromMapsUrl);

app.get('/v1/auth/session', sessionHandler);
app.post('/v1/auth/signup', signupHandler);
app.post('/v1/auth/login', loginHandler);
app.post('/v1/auth/logout', logoutHandler);
app.post('/v1/auth/claim-anon', claimAnonHandler);
app.post('/v1/auth/magic-link', magicLinkHandler);
app.post('/v1/auth/reset', resetHandler);
app.get('/v1/auth/export', exportAccountHandler);
app.delete('/v1/auth/account', deleteAccountHandler);

app.get('/v1/vehicles/catalogue/makes', listMakesHandler);
app.get('/v1/vehicles/catalogue/models', listModelsHandler);
app.get('/v1/vehicles/catalogue', listCatalogueHandler);
app.get('/v1/vehicles/catalogue/:id', getCatalogueHandler);
app.get('/v1/vehicles', listVehiclesHandler);
app.post('/v1/vehicles', createVehicleHandler);
app.patch('/v1/vehicles/:id', patchVehicleHandler);
app.delete('/v1/vehicles/:id', deleteVehicleHandler);
app.get('/v1/vehicles/:id/tariffs', listTariffsHandler);
app.post('/v1/vehicles/:id/tariffs', createTariffHandler);

app.post('/v1/journeys', saveJourneyHandler);
app.get('/v1/journeys', listJourneysHandler);
app.get('/v1/journeys/export', exportJourneysHandler);
app.get('/v1/journeys/:id', getJourneyHandler);
app.delete('/v1/journeys/:id', deleteJourneyHandler);

export default app;
export type { ApiBindings } from './env.js';
