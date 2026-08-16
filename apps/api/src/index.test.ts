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
});
