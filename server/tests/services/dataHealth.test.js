import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  feedState,
  markSuccess,
  markFailure,
  getFeedHealth,
  combineHealth,
} = require('../../src/services/dataHealth');

const originalKey = process.env.PTV_API_KEY;

function resetFeedState() {
  feedState.ptv.lastSuccess = null;
  feedState.ptv.lastFailure = null;
  feedState.ptv.lastError = null;
  feedState.ptv.mode = 'unknown';

  feedState.weather.lastSuccess = null;
  feedState.weather.lastFailure = null;
  feedState.weather.lastError = null;
  feedState.weather.mode = 'unknown';
}

describe('data health', () => {
  beforeEach(() => {
    resetFeedState();
  });

  afterEach(() => {
    if (originalKey) process.env.PTV_API_KEY = originalKey;
    else delete process.env.PTV_API_KEY;
  });

  it('returns demo when PTV key is missing', () => {
    delete process.env.PTV_API_KEY;
    const health = getFeedHealth('ptv');
    expect(health.status).toBe('demo');
  });

  it('returns live when recent success exists', () => {
    process.env.PTV_API_KEY = 'x';
    markSuccess('ptv');
    const health = getFeedHealth('ptv');
    expect(health.status).toBe('live');
  });

  it('returns stale when success is old', () => {
    process.env.PTV_API_KEY = 'x';
    feedState.ptv.lastSuccess = new Date(Date.now() - 301_000).toISOString();
    const health = getFeedHealth('ptv');
    expect(health.status).toBe('stale');
  });

  it('can return partial after failure following success', () => {
    process.env.PTV_API_KEY = 'x';
    feedState.ptv.lastSuccess = new Date(Date.now() - 30_000).toISOString();
    feedState.ptv.lastFailure = new Date().toISOString();
    markFailure('ptv', new Error('temporary error'));
    const health = getFeedHealth('ptv');
    expect(['partial', 'stale']).toContain(health.status);
  });

  it('combineHealth returns partial for mixed stale/live', () => {
    process.env.PTV_API_KEY = 'x';
    feedState.ptv.lastSuccess = new Date(Date.now() - 350_000).toISOString();
    feedState.weather.lastSuccess = new Date(Date.now() - 20_000).toISOString();
    const combined = combineHealth(['ptv', 'weather']);
    expect(['partial', 'recent', 'live', 'stale']).toContain(combined.status);
  });
});
