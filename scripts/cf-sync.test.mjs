import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CONFIG_VAR_KEYS,
  parseArgs,
  planCloudflareSync,
  varsFromWranglerConfig,
  wranglerEnvFlag,
  wranglerWorkerName,
} from './cf-sync.mjs';

describe('wranglerEnvFlag', () => {
  it('maps Brim env names onto Wrangler --env flags', () => {
    assert.equal(wranglerEnvFlag('dev'), '');
    assert.equal(wranglerEnvFlag('staging'), 'staging');
    assert.equal(wranglerEnvFlag('prod'), 'production');
  });
});

describe('wranglerWorkerName', () => {
  it('targets one Worker per environment', () => {
    assert.equal(wranglerWorkerName('dev'), 'brim-api');
    assert.equal(wranglerWorkerName('staging'), 'brim-api-staging');
    assert.equal(wranglerWorkerName('prod'), 'brim-api-production');
  });
});

describe('varsFromWranglerConfig', () => {
  const config = {
    vars: { BRIM_FIXTURES: '0' },
    env: {
      staging: { vars: { BRIM_FIXTURES: '1', WEB_ORIGIN: 'https://staging.example' } },
      production: { vars: { BRIM_FIXTURES: '0', WEB_ORIGIN: 'https://prod.example' } },
    },
  };

  it('reads top-level vars for local/dev', () => {
    assert.deepEqual(varsFromWranglerConfig(config, 'dev'), { BRIM_FIXTURES: '0' });
  });

  it('does not inherit top-level vars into named environments', () => {
    assert.deepEqual(varsFromWranglerConfig(config, 'staging'), {
      BRIM_FIXTURES: '1',
      WEB_ORIGIN: 'https://staging.example',
    });
  });
});

describe('planCloudflareSync', () => {
  it('uploads filled secrets and leaves wrangler.jsonc vars alone', () => {
    const plan = planCloudflareSync(
      {
        DATABASE_URL: 'postgres://x',
        BETTER_AUTH_SECRET: 's',
        OSRM_URL: '',
        BRIM_FIXTURES: '1',
        WEB_ORIGIN: 'https://staging.example',
        VITE_API_BASE: 'http://localhost:8787',
      },
      { BRIM_FIXTURES: '1', WEB_ORIGIN: 'https://staging.example' },
    );
    assert.deepEqual(plan.secretKeys, ['BETTER_AUTH_SECRET', 'DATABASE_URL']);
    assert.deepEqual(plan.skippedEmpty, ['OSRM_URL']);
    assert.deepEqual(plan.skippedVite, ['VITE_API_BASE']);
    assert.deepEqual(plan.configVarKeys, CONFIG_VAR_KEYS);
    assert.deepEqual(plan.varDrift, []);
    assert.equal(plan.secrets.DATABASE_URL, 'postgres://x');
  });

  it('reports var drift by key name only', () => {
    const plan = planCloudflareSync(
      { WEB_ORIGIN: 'https://wrong.example', BRIM_FIXTURES: '0' },
      { WEB_ORIGIN: 'https://staging.example', BRIM_FIXTURES: '1' },
    );
    assert.deepEqual(plan.varDrift, ['BRIM_FIXTURES', 'WEB_ORIGIN']);
    assert.deepEqual(plan.secretKeys, []);
    assert.equal(JSON.stringify(plan).includes('wrong.example'), false);
    assert.equal(JSON.stringify(plan).includes('staging.example'), false);
  });
});

describe('parseArgs', () => {
  it('treats --yes on the child argv as confirmation', () => {
    assert.deepEqual(parseArgs(['--yes'], {}), { dryRun: false, yes: true });
  });

  it('treats npm --yes (npm_config_yes) as confirmation', () => {
    assert.deepEqual(parseArgs([], { npm_config_yes: 'true' }), { dryRun: false, yes: true });
  });

  it('does not confirm without --yes', () => {
    assert.deepEqual(parseArgs(['--dry-run'], {}), { dryRun: true, yes: false });
  });
});
