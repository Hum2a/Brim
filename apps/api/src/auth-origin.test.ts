import { describe, expect, it } from 'vitest';
import { allowedWebOrigin, trustedOrigins } from './auth.js';

describe('allowedWebOrigin', () => {
  it('allows the canonical custom domains', () => {
    expect(allowedWebOrigin('https://brim.humza-butt.space')).toBe('https://brim.humza-butt.space');
    expect(allowedWebOrigin('https://brim-staging.humza-butt.space')).toBe(
      'https://brim-staging.humza-butt.space',
    );
  });

  it('allows the workers.dev host for each environment', () => {
    expect(allowedWebOrigin('https://brim-api-staging.humzab1711.workers.dev')).toBe(
      'https://brim-api-staging.humzab1711.workers.dev',
    );
    expect(allowedWebOrigin('http://localhost:5173')).toBe('http://localhost:5173');
  });

  it('rejects unrelated origins', () => {
    expect(allowedWebOrigin('https://oche.humza-butt.space')).toBeUndefined();
    expect(allowedWebOrigin('https://evil.example')).toBeUndefined();
  });

  it('includes canonical hosts in trustedOrigins', () => {
    const origins = trustedOrigins({});
    expect(origins).toContain('https://brim.humza-butt.space');
    expect(origins).toContain('https://brim-staging.humza-butt.space');
  });
});
