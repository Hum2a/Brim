import { describe, expect, it } from 'vitest';
import app from './index.js';

const env = { BRIM_FIXTURES: '1' };

describe('charges API', () => {
  it('lists public zones with verified_on', async () => {
    const res = await app.request('/v1/zones', {}, env);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      zones: Array<{ id: string; verifiedOn: string }>;
      tolls: Array<{ id: string }>;
    };
    expect(json.zones.some((z) => z.id === 'london-ulez')).toBe(true);
    expect(json.zones.some((z) => z.id === 'birmingham-caz')).toBe(true);
    expect(json.zones.some((z) => z.id === 'glasgow-lez')).toBe(true);
    expect(json.tolls.some((t) => t.id === 'dart-charge')).toBe(true);
    expect(json.tolls.some((t) => t.id === 'm6-toll')).toBe(true);
    expect(json.zones.every((z) => z.verifiedOn.length === 10)).toBe(true);
  });

  it('puts ULEZ and CC on Crawley to London in weekday hours', async () => {
    const res = await app.request(
      '/v1/estimate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: 'Crawley',
          destination: 'London',
          departsAt: '2026-08-14T08:00:00Z',
          propulsion: 'diesel',
          vehicleInline: {
            kind: 'car',
            propulsion: 'diesel',
            euroStatus: 'Euro 5',
            euroStatusSource: 'derived',
            userEnteredConsumption: 40,
            userEnteredUnit: 'mpg',
          },
        }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      charges: Array<{ id: string; pence: number }>;
      cost: { chargesPence: number };
      encodedPolyline: string;
    };
    expect(json.charges.some((c) => c.id.startsWith('london-ulez') && c.pence === 1250)).toBe(true);
    expect(json.charges.some((c) => c.id.startsWith('london-cc') && c.pence === 1500)).toBe(true);
    expect(json.cost.chargesPence).toBe(2750);

    const forRoute = await app.request(
      '/v1/charges/for-route',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          polyline: json.encodedPolyline,
          departsAt: '2026-08-14T08:00:00Z',
          vehicleInline: { kind: 'car', propulsion: 'diesel', euroStatus: 'Euro 5' },
        }),
      },
      env,
    );
    expect(forRoute.status).toBe(200);
    const routed = (await forRoute.json()) as { charges: Array<{ id: string }> };
    expect(routed.charges.some((c) => c.id.startsWith('london-ulez'))).toBe(true);
  });

  it('does not put a pound figure on Glasgow LEZ', async () => {
    const res = await app.request(
      '/v1/estimate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: 'Edinburgh',
          destination: 'Glasgow',
          departsAt: '2026-08-14T08:00:00Z',
          vehicleInline: {
            kind: 'car',
            propulsion: 'diesel',
            euroStatus: 'Euro 5',
            euroStatusSource: 'derived',
          },
        }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      charges: Array<{ kind: string; pence: number }>;
      warnings: Array<{ code: string }>;
    };
    expect(json.charges.some((c) => c.kind === 'restriction' && c.pence === 0)).toBe(true);
    expect(json.warnings.some((w) => w.code === 'restriction')).toBe(true);
  });
});
