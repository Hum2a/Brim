import { describe, expect, it } from 'vitest';
import app from './index.js';

describe('api', () => {
  it('serves /health in fixture mode', async () => {
    const res = await app.request('/health', {}, { BRIM_FIXTURES: '1' });
    const json = (await res.json()) as { status: string; fixtureMode: boolean };
    expect(json.status).toBe('ok');
    expect(json.fixtureMode).toBe(true);
  });

  it('estimates a fixture journey', async () => {
    const res = await app.request(
      '/v1/estimate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: 'Crawley',
          destination: 'London',
          propulsion: 'petrol',
          vehicleInline: {
            kind: 'car',
            propulsion: 'petrol',
            userEnteredConsumption: 40,
            userEnteredUnit: 'mpg',
          },
        }),
      },
      { BRIM_FIXTURES: '1' },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      cost: { totalPence: { point: number } };
      consumption: { label: string };
      encodedPolyline: string;
      origin?: { label: string; lat: number; lng: number };
      destination?: { label: string; lat: number; lng: number };
      alternatives?: Array<{ id: string; encodedPolyline: string; costPence: number }>;
      price?: { pence: number; unit: string; source: string; observedAt: string };
      warnings: Array<{ code: string }>;
    };
    expect(json.cost.totalPence.point).toBeGreaterThan(0);
    expect(json.consumption.label.length).toBeGreaterThan(0);
    expect(json.encodedPolyline.length).toBeGreaterThan(0);
    expect(json.origin?.label).toBe("Crawley");
    expect(json.destination?.label).toBe("London");
    expect(json.alternatives?.length).toBeGreaterThanOrEqual(1);
    expect(json.alternatives?.[0]?.encodedPolyline.length).toBeGreaterThan(0);
    expect(json.alternatives?.[0]?.costPence).toBeGreaterThan(0);
    expect(json.alternatives?.[1]?.costPence).toBeGreaterThan(json.alternatives?.[0]?.costPence ?? 0);
    expect(json.price?.source).toBe('home-area-median');
    expect(json.price?.pence).toBe(132.2);
    expect(json.price?.unit).toBe('ppl');
    expect(json.price?.observedAt).not.toBe('1970-01-01T00:00:00Z');
    expect(json.warnings.some((w) => w.code === 'price-data-unavailable')).toBe(false);
  });

  it("accepts coordinate pins on the estimate body", async () => {
    const res = await app.request(
      '/v1/estimate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { lat: 51.1092, lng: -0.1872, label: 'Crawley' },
          destination: { lat: 51.5074, lng: -0.1278, label: 'London' },
          propulsion: 'petrol',
        }),
      },
      { BRIM_FIXTURES: '1' },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { encodedPolyline: string };
    expect(json.encodedPolyline.length).toBeGreaterThan(0);
  });

  it('serves fixture national medians', async () => {
    const res = await app.request('/v1/meta/prices', {}, { BRIM_FIXTURES: '1' });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      grades: Record<string, { pence: number; observedAt: string; sampleCount: number }>;
    };
    expect(json.grades.E10?.pence).toBe(134.5);
    expect(json.grades.E10?.sampleCount).toBeGreaterThan(0);
    expect(json.grades.B7?.pence).toBeGreaterThan(0);
  });

  it('lists nearby fixture stations around Crawley', async () => {
    const res = await app.request(
      '/v1/stations/near?lat=51.1092&lng=-0.1872&grade=E10',
      {},
      { BRIM_FIXTURES: '1' },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      stations: Array<{ id: string; lat: number; lng: number; pence?: number }>;
    };
    expect(json.stations.some((s) => s.id === 'ff_shell_crawley')).toBe(true);
    expect(json.stations.some((s) => s.id === 'ff_shell_york_stale')).toBe(false);
    expect(json.stations.some((s) => s.id === 'ff_gulf_crawley_silent')).toBe(false);
  });

  it('uses a picked station price when stationId is on the estimate body', async () => {
    const res = await app.request(
      '/v1/estimate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: 'Crawley',
          destination: 'London',
          propulsion: 'petrol',
          stationId: 'ff_shell_crawley',
        }),
      },
      { BRIM_FIXTURES: '1' },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      price: { pence: number; source: string; stationId?: string };
    };
    expect(json.price.source).toBe('user-picked-station');
    expect(json.price.pence).toBe(129.9);
    expect(json.price.stationId).toBe('ff_shell_crawley');
  });

  it('leaves BEV on the 7.5 p/kWh fallback', async () => {
    const res = await app.request(
      '/v1/estimate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: 'Crawley',
          destination: 'London',
          propulsion: 'bev',
          vehicleInline: {
            kind: 'car',
            propulsion: 'bev',
            userEnteredConsumption: 3.8,
            userEnteredUnit: 'mi/kWh',
          },
        }),
      },
      { BRIM_FIXTURES: '1' },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      price: { pence: number; unit: string; source: string };
      reasons: string[];
      warnings: Array<{ code: string }>;
    };
    expect(json.price.unit).toBe('p/kWh');
    expect(json.price.pence).toBe(7.5);
    expect(json.price.source).toBe('hardcoded-fallback');
    expect(json.warnings.some((w) => w.code === 'price-data-unavailable')).toBe(true);
    expect(json.reasons.some((r) => r.includes('150 g/kWh'))).toBe(true);
    expect(json.reasons.some((r) => r.includes('12°C'))).toBe(true);
  });

  it('uses a user EV tariff and fixture grid intensity at leave time', async () => {
    const res = await app.request(
      '/v1/estimate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: 'Crawley',
          destination: 'London',
          propulsion: 'bev',
          departsAt: '2026-08-16T12:00:00Z',
          priceStrategy: 'user-tariff',
          pricePence: 7.5,
          vehicleInline: {
            kind: 'car',
            propulsion: 'bev',
            userEnteredConsumption: 3.8,
            userEnteredUnit: 'mi/kWh',
            batteryKwhUsable: 64,
            startChargePercent: 80,
          },
        }),
      },
      { BRIM_FIXTURES: '1' },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      price: { source: string; pence: number };
      reasons: string[];
      energy: { arrivalStateOfCharge?: { verdict: string } };
    };
    expect(json.price.source).toBe('user-tariff');
    expect(json.price.pence).toBe(7.5);
    expect(json.reasons.some((r) => r.includes('190 g/kWh'))).toBe(true);
    expect(json.energy.arrivalStateOfCharge?.verdict).toBeTruthy();
  });

  it('uses the public-network table for DC charging', async () => {
    const res = await app.request(
      '/v1/estimate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: 'Crawley',
          destination: 'London',
          propulsion: 'bev',
          chargingLocation: 'public',
          network: 'ionity',
          chargingSpeed: 'dc',
          vehicleInline: {
            kind: 'car',
            propulsion: 'bev',
            userEnteredConsumption: 3.8,
            userEnteredUnit: 'mi/kWh',
          },
        }),
      },
      { BRIM_FIXTURES: '1' },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { price: { source: string; pence: number } };
    expect(json.price.source).toBe('network-table');
    expect(json.price.pence).toBe(74);
  });

  it('serves the dated EV network table', async () => {
    const res = await app.request('/v1/meta/ev-tariffs', {}, { BRIM_FIXTURES: '1' });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { networks: Array<{ id: string }>; fallbacks: { home: { pencePerKwh: number } } };
    expect(json.fallbacks.home.pencePerKwh).toBe(7.5);
    expect(json.networks.some((n) => n.id === 'ionity')).toBe(true);
  });

  it('uses the national median when the start is outside the fixture cluster', async () => {
    const res = await app.request(
      '/v1/estimate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: 'Edinburgh',
          destination: 'London',
          propulsion: 'petrol',
          stationId: 'missing-station',
        }),
      },
      { BRIM_FIXTURES: '1' },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      price: { pence: number; source: string };
      warnings: Array<{ code: string; message: string }>;
    };
    expect(json.price.source).toBe('national-median');
    expect(json.price.pence).toBe(134.5);
    expect(json.warnings.some((w) => w.code === 'price-data-unavailable')).toBe(false);
  });

  it('autocompletes fixture streets', async () => {
    const res = await app.request('/v1/places?q=Station', {}, { BRIM_FIXTURES: '1' });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { places: Array<{ label: string; lat?: number }> };
    expect(json.places.some((p) => p.label.includes('Station Road'))).toBe(true);
  });

  it('returns no places for a one-letter query', async () => {
    const res = await app.request('/v1/places?q=C', {}, { BRIM_FIXTURES: '1' });
    const json = (await res.json()) as { places: unknown[] };
    expect(json.places).toEqual([]);
  });

  it('resolves a fixture place id', async () => {
    const list = await app.request('/v1/places?q=Deansgate', {}, { BRIM_FIXTURES: '1' });
    const { places } = (await list.json()) as { places: Array<{ placeId: string; label: string }> };
    const placeId = places[0]?.placeId;
    expect(placeId).toBeTruthy();
    const res = await app.request(
      '/v1/places/resolve',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId }),
      },
      { BRIM_FIXTURES: '1' },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { place: { label: string; lat: number } };
    expect(json.place.label).toBe('Deansgate, Manchester');
  });

  it('reverse geocodes a pin far from towns without inventing a street', async () => {
    const res = await app.request(
      '/v1/places/reverse',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: 50, lng: -5 }),
      },
      { BRIM_FIXTURES: '1' },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { place: { label: string } };
    expect(json.place.label.startsWith('Pinned location')).toBe(true);
  });

  it('searches the fixture VCA catalogue', async () => {
    const res = await app.request('/v1/vehicles/catalogue?q=focus', {}, { BRIM_FIXTURES: '1' });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      vehicles: Array<{ model: string; officialCycle: string }>;
    };
    expect(json.vehicles.length).toBeGreaterThan(0);
    expect(json.vehicles.some((v) => v.model.toLowerCase() === 'focus')).toBe(true);
  });

  it('returns no catalogue hits for an empty query', async () => {
    const res = await app.request('/v1/vehicles/catalogue?q=', {}, { BRIM_FIXTURES: '1' });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { vehicles: unknown[] };
    expect(json.vehicles).toEqual([]);
  });

  it('404s an unknown catalogue id', async () => {
    const res = await app.request('/v1/vehicles/catalogue/not-a-car', {}, { BRIM_FIXTURES: '1' });
    expect(res.status).toBe(404);
  });

  it('returns a catalogue row by id', async () => {
    const res = await app.request(
      '/v1/vehicles/catalogue/vca_ford_focus_10_titanium',
      {},
      { BRIM_FIXTURES: '1' },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { make: string; officialUnit: string; propulsion: string };
    expect(json.make).toBe('Ford');
    expect(json.propulsion).toBe('petrol');
    expect(json.officialUnit).toBe('mpg');
  });

  it('lists fixture makes with Ford pinned', async () => {
    const res = await app.request('/v1/vehicles/catalogue/makes', {}, { BRIM_FIXTURES: '1' });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { makes: Array<{ name: string; count: number }> };
    expect(json.makes.some((m) => m.name === 'Ford' && m.count >= 2)).toBe(true);
    expect(json.makes[0]?.name).toBe('Ford');
  });

  it('lists Ford models from the fixture catalogue', async () => {
    const res = await app.request(
      '/v1/vehicles/catalogue/models?make=Ford',
      {},
      { BRIM_FIXTURES: '1' },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { models: Array<{ name: string }> };
    expect(json.models.map((m) => m.name)).toEqual(expect.arrayContaining(['Fiesta', 'Focus']));
  });

  it('lists Focus trims for make and model', async () => {
    const res = await app.request(
      '/v1/vehicles/catalogue?make=Ford&model=Focus',
      {},
      { BRIM_FIXTURES: '1' },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { vehicles: Array<{ derivative?: string }> };
    expect(json.vehicles.some((v) => v.derivative?.includes('Titanium'))).toBe(true);
  });

  it('uses official consumption as tier 2 when the user did not type mpg', async () => {
    const res = await app.request(
      '/v1/estimate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: 'Crawley',
          destination: 'London',
          propulsion: 'petrol',
          vehicleInline: {
            kind: 'car',
            propulsion: 'petrol',
            officialConsumption: 51.4,
            officialUnit: 'mpg',
            officialCycle: 'WLTP',
          },
        }),
      },
      { BRIM_FIXTURES: '1' },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { consumption: { label: string; tier: number } };
    expect(json.consumption.tier).toBe(2);
    expect(json.consumption.label).toBe('Official figure, adjusted');
  });

  it('lets a typed mpg override the official figure', async () => {
    const res = await app.request(
      '/v1/estimate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: 'Crawley',
          destination: 'London',
          vehicleInline: {
            kind: 'car',
            propulsion: 'petrol',
            officialConsumption: 51.4,
            officialUnit: 'mpg',
            officialCycle: 'WLTP',
            userEnteredConsumption: 40,
            userEnteredUnit: 'mpg',
          },
        }),
      },
      { BRIM_FIXTURES: '1' },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { consumption: { label: string; tier: number } };
    expect(json.consumption.tier).toBe(1);
    expect(json.consumption.label).toBe('You told us');
  });

  it('saves a vehicle on the anon session and lists it back', async () => {
    const created = await app.request(
      '/v1/vehicles',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: 'Fixture car',
          kind: 'car',
          propulsion: 'petrol',
          make: 'Ford',
          model: 'Focus',
        }),
      },
      { BRIM_FIXTURES: '1' },
    );
    expect(created.status).toBe(201);
    const cookie = created.headers.get('set-cookie') ?? '';
    const listed = await app.request(
      '/v1/vehicles',
      { headers: { Cookie: cookie.split(';')[0] ?? '' } },
      { BRIM_FIXTURES: '1' },
    );
    expect(listed.status).toBe(200);
    const json = (await listed.json()) as { vehicles: Array<{ nickname?: string }> };
    expect(json.vehicles.some((v) => v.nickname === 'Fixture car')).toBe(true);
  });

  it('calibrates after four brim fill-ups and uses it on estimate', async () => {
    const created = await app.request(
      '/v1/vehicles',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: 'Calib car', kind: 'car', propulsion: 'petrol' }),
      },
      { BRIM_FIXTURES: '1' },
    );
    const cookie = created.headers.get('set-cookie')?.split(';')[0] ?? '';
    const vehicle = (await created.json()) as { id: string };
    const headers = { 'Content-Type': 'application/json', Cookie: cookie };
    async function log(odometerMiles: number, n: number) {
      const res = await app.request(
        '/v1/fill-ups',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            vehicleId: vehicle.id,
            odometerMiles,
            quantity: 40,
            unit: 'litres',
            price: 5800,
            brim: true,
            occurredAt: `2026-0${n}-01T00:00:00Z`,
          }),
        },
        { BRIM_FIXTURES: '1' },
      );
      expect(res.status).toBe(201);
    }
    await log(10000, 1);
    await log(10300, 2);
    const two = await app.request(
      `/v1/vehicles/${vehicle.id}/calibration`,
      { headers: { Cookie: cookie } },
      { BRIM_FIXTURES: '1' },
    );
    const twoJson = (await two.json()) as { sampleCount: number; confidence: string };
    expect(twoJson.sampleCount).toBe(1);
    expect(twoJson.confidence).toBe('building');
    await log(10600, 3);
    await log(10900, 4);
    const calib = await app.request(
      `/v1/vehicles/${vehicle.id}/calibration`,
      { headers: { Cookie: cookie } },
      { BRIM_FIXTURES: '1' },
    );
    const calibJson = (await calib.json()) as { sampleCount: number; confidence: string };
    expect(calibJson.sampleCount).toBe(3);
    expect(calibJson.confidence).toBe('calibrated');
    const estimate = await app.request(
      '/v1/estimate',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          origin: 'Crawley',
          destination: 'London',
          vehicleId: vehicle.id,
        }),
      },
      { BRIM_FIXTURES: '1' },
    );
    const est = (await estimate.json()) as { consumption: { tier: number; label: string } };
    expect(est.consumption.tier).toBe(0);
    expect(est.consumption.label).toBe('Based on your fill-ups');
  });

  it('upserts home and stores a default vehicle', async () => {
    const created = await app.request(
      '/v1/vehicles',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: 'Default car', kind: 'car', propulsion: 'diesel' }),
      },
      { BRIM_FIXTURES: '1' },
    );
    const cookie = created.headers.get('set-cookie')?.split(';')[0] ?? '';
    const vehicle = (await created.json()) as { id: string };
    const headers = { 'Content-Type': 'application/json', Cookie: cookie };
    const setDefault = await app.request(
      '/v1/settings',
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ defaultVehicleId: vehicle.id }),
      },
      { BRIM_FIXTURES: '1' },
    );
    expect(setDefault.status).toBe(200);
    const home = await app.request(
      '/v1/saved-places',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ kind: 'home', label: 'Crawley', lat: 51.1, lng: -0.18 }),
      },
      { BRIM_FIXTURES: '1' },
    );
    expect(home.status).toBe(201);
    const again = await app.request(
      '/v1/saved-places',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ kind: 'home', label: 'Horsham', lat: 51.06, lng: -0.33 }),
      },
      { BRIM_FIXTURES: '1' },
    );
    expect(again.status).toBe(200);
    const listed = await app.request('/v1/saved-places', { headers: { Cookie: cookie } }, { BRIM_FIXTURES: '1' });
    const places = (await listed.json()) as { places: Array<{ kind: string; label: string }> };
    expect(places.places.filter((p) => p.kind === 'home')).toHaveLength(1);
    expect(places.places[0]?.label).toBe('Horsham');
  });
});
