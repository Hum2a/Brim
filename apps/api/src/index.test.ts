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
    };
    expect(json.cost.totalPence.point).toBeGreaterThan(0);
    expect(json.consumption.label.length).toBeGreaterThan(0);
    expect(json.encodedPolyline.length).toBeGreaterThan(0);
    expect(json.origin?.label).toBe("Crawley");
    expect(json.destination?.label).toBe("London");
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
});
