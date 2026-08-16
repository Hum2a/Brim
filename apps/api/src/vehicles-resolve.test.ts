import { beforeEach, describe, expect, it } from 'vitest';
import app from './index.js';
import { getMemoryDb, resetMemoryDb } from './db/memory.js';

const origin = 'http://localhost:5173';
const FIXTURE_KEY = 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE';

function cookieHeader(res: Response): string {
  const many = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  if (many.length > 0) {
    return many
      .map((entry) => entry.split(';')[0] ?? '')
      .filter(Boolean)
      .join('; ');
  }
  const single = res.headers.get('set-cookie');
  return single ? (single.split(';')[0] ?? '') : '';
}

describe('vehicles resolve', () => {
  beforeEach(() => {
    resetMemoryDb();
  });

  it('joins a unique fixture plate without echoing the VRM', async () => {
    const res = await app.request(
      '/v1/vehicles/resolve',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vrm: 'ab12 cde' }),
      },
      { BRIM_FIXTURES: '1' },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      outcome: string;
      ves: { make: string; euroStatus?: string; year?: number };
      candidates: Array<{ id: string }>;
    };
    expect(json.outcome).toBe('single');
    expect(json.candidates[0]?.id).toBe('vca_vw_golf_15_tsi');
    expect(json.ves.euroStatus).toBe('EURO 6');
    expect(json.ves.year).toBe(2021);
    expect(JSON.stringify(json)).not.toMatch(/AB12CDE/i);
  });

  it('returns a few Ford matches', async () => {
    const res = await app.request(
      '/v1/vehicles/resolve',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vrm: 'XY98ZAB' }),
      },
      { BRIM_FIXTURES: '1' },
    );
    const json = (await res.json()) as { outcome: string; candidates: Array<{ id: string }> };
    expect(json.outcome).toBe('few');
    expect(json.candidates).toHaveLength(2);
  });

  it('keeps euro when the join is empty', async () => {
    const res = await app.request(
      '/v1/vehicles/resolve',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vrm: 'ZZ99ZZZ' }),
      },
      { BRIM_FIXTURES: '1' },
    );
    const json = (await res.json()) as {
      outcome: string;
      ves: { euroStatus?: string };
      candidates: unknown[];
    };
    expect(json.outcome).toBe('none');
    expect(json.candidates).toEqual([]);
    expect(json.ves.euroStatus).toBe('EURO 5');
  });

  it('returns 404 for an unknown well-formed plate and 400 for junk', async () => {
    const missing = await app.request(
      '/v1/vehicles/resolve',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vrm: 'AA00AAA' }),
      },
      { BRIM_FIXTURES: '1' },
    );
    expect(missing.status).toBe(404);
    const bad = await app.request(
      '/v1/vehicles/resolve',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vrm: 'NOPE' }),
      },
      { BRIM_FIXTURES: '1' },
    );
    expect(bad.status).toBe(400);
  });

  it('returns 503 when DVLA_VES_API_KEY is missing outside fixture mode', async () => {
    const res = await app.request(
      '/v1/vehicles/resolve',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vrm: 'AB12CDE' }),
      },
      {},
    );
    expect(res.status).toBe(503);
    const json = (await res.json()) as { error: string; reason?: string };
    expect(json.error).toBe('dvla_unavailable');
    expect(json.reason).toMatch(/DVLA_VES_API_KEY/);
    expect(JSON.stringify(json)).not.toMatch(/AB12CDE/i);
  });

  it('does not persist a VRM on an anon save', async () => {
    const created = await app.request(
      '/v1/vehicles',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: 'Anon golf',
          kind: 'car',
          propulsion: 'petrol',
          vrm: 'AB12CDE',
        }),
      },
      { BRIM_FIXTURES: '1', VRM_ENCRYPTION_KEY: FIXTURE_KEY },
    );
    expect(created.status).toBe(201);
    const json = (await created.json()) as Record<string, unknown>;
    expect(json.vrm).toBeUndefined();
    expect(json.vrm_hash).toBeUndefined();
    expect(json.vrm_encrypted).toBeUndefined();
    const stored = [...getMemoryDb().vehicles.values()][0];
    expect(stored?.vrm_hash).toBeUndefined();
    expect(stored?.vrm_encrypted).toBeUndefined();
  });

  it('encrypts a VRM only for a signed-in save and never lists it', async () => {
    const env = { BRIM_FIXTURES: '1', VRM_ENCRYPTION_KEY: FIXTURE_KEY };
    const signup = await app.request(
      '/v1/auth/sign-up/email',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({ email: 'reg@example.com', password: 'password1', name: 'reg' }),
      },
      env,
    );
    expect(signup.status).toBeLessThan(400);
    const cookie = cookieHeader(signup);
    const created = await app.request(
      '/v1/vehicles',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: origin },
        body: JSON.stringify({
          nickname: 'Saved golf',
          kind: 'car',
          propulsion: 'petrol',
          vrm: 'AB12CDE',
        }),
      },
      env,
    );
    expect(created.status).toBe(201);
    const body = (await created.json()) as Record<string, unknown>;
    expect(body.vrm).toBeUndefined();
    expect(body.vrm_hash).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/AB12CDE/i);
    const stored = [...getMemoryDb().vehicles.values()].find((v) => v.nickname === 'Saved golf');
    expect(stored?.vrm_hash).toBeTruthy();
    expect(stored?.vrm_encrypted?.startsWith('v1:')).toBe(true);
    expect(stored?.vrm_encrypted).not.toMatch(/AB12CDE/i);

    const listed = await app.request('/v1/vehicles', { headers: { Cookie: cookie, Origin: origin } }, env);
    const json = (await listed.json()) as { vehicles: Array<Record<string, unknown>> };
    expect(json.vehicles[0]?.vrm_hash).toBeUndefined();
    expect(json.vehicles[0]?.vrm_encrypted).toBeUndefined();
    expect(JSON.stringify(json)).not.toMatch(/AB12CDE/i);
  });
});
