import { beforeEach, describe, expect, it } from 'vitest';
import app from './index.js';
import { resetMemoryDb } from './db/memory.js';

const env = { BRIM_FIXTURES: '1' };

function cookieFrom(res: Response): string {
  return res.headers.get('set-cookie')?.split(';')[0] ?? '';
}

async function createCar(propulsion: 'petrol' | 'bev', nickname: string) {
  const created = await app.request(
    '/v1/vehicles',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, kind: 'car', propulsion }),
    },
    env,
  );
  expect(created.status).toBe(201);
  const vehicle = (await created.json()) as { id: string };
  const cookie = cookieFrom(created);
  return { vehicle, cookie, headers: { 'Content-Type': 'application/json', Cookie: cookie } };
}

describe('fill-ups', () => {
  beforeEach(() => {
    resetMemoryDb();
  });

  it('rejects litres on a BEV and odometer rollback', async () => {
    const { vehicle, headers } = await createCar('bev', 'Leaf');
    const litres = await app.request(
      '/v1/fill-ups',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          vehicleId: vehicle.id,
          odometerMiles: 10000,
          quantity: 40,
          unit: 'litres',
          price: 0,
          brim: true,
        }),
      },
      env,
    );
    expect(litres.status).toBe(400);
    expect(((await litres.json()) as { error: string }).error).toBe('unit_mismatch');

    const first = await app.request(
      '/v1/fill-ups',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          vehicleId: vehicle.id,
          odometerMiles: 10000,
          quantity: 16,
          unit: 'kwh',
          price: 120,
          brim: true,
        }),
      },
      env,
    );
    expect(first.status).toBe(201);

    const rollback = await app.request(
      '/v1/fill-ups',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          vehicleId: vehicle.id,
          odometerMiles: 9999,
          quantity: 16,
          unit: 'kwh',
          price: 120,
          brim: true,
        }),
      },
      env,
    );
    expect(rollback.status).toBe(400);
    expect(((await rollback.json()) as { error: string }).error).toBe('odometer_rollback');
  });

  it('calibrates a BEV after four full charges', async () => {
    const { vehicle, cookie, headers } = await createCar('bev', 'Leaf calib');
    async function log(odometerMiles: number, n: number) {
      const res = await app.request(
        '/v1/fill-ups',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            vehicleId: vehicle.id,
            odometerMiles,
            quantity: n === 1 ? 40 : 16,
            unit: 'kwh',
            price: 0,
            brim: true,
            occurredAt: `2026-0${n}-01T00:00:00Z`,
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    }
    await log(10000, 1);
    await log(10100, 2);
    await log(10200, 3);
    await log(10300, 4);
    const calib = await app.request(
      `/v1/vehicles/${vehicle.id}/calibration`,
      { headers: { Cookie: cookie } },
      env,
    );
    const json = (await calib.json()) as { sampleCount: number; confidence: string; unit?: string };
    expect(json.sampleCount).toBe(3);
    expect(json.confidence).toBe('calibrated');
    expect(json.unit).toBe('kWh/100km');
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
      env,
    );
    const est = (await estimate.json()) as { consumption: { tier: number; label: string } };
    expect(est.consumption.tier).toBe(0);
    expect(est.consumption.label).toBe('Based on your fill-ups');
  });

  it('drops back to building after deleting a brim fill', async () => {
    const { vehicle, cookie, headers } = await createCar('petrol', 'Delete calib');
    const ids: string[] = [];
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
        env,
      );
      expect(res.status).toBe(201);
      ids.push(((await res.json()) as { id: string }).id);
    }
    await log(10000, 1);
    await log(10300, 2);
    await log(10600, 3);
    await log(10900, 4);
    const last = ids[ids.length - 1];
    expect(last).toBeTruthy();
    const deleted = await app.request(`/v1/fill-ups/${last}`, { method: 'DELETE', headers }, env);
    expect(deleted.status).toBe(200);
    const calib = await app.request(
      `/v1/vehicles/${vehicle.id}/calibration`,
      { headers: { Cookie: cookie } },
      env,
    );
    const json = (await calib.json()) as { sampleCount: number; confidence: string };
    expect(json.sampleCount).toBe(2);
    expect(json.confidence).toBe('building');
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
      env,
    );
    const est = (await estimate.json()) as { consumption: { tier: number } };
    expect(est.consumption.tier).not.toBe(0);
  });
});
