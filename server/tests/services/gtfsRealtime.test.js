import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cache = require('../../src/services/cache');
const gtfsRealtime = require('../../src/services/gtfsRealtime');

describe('gtfsRealtime demo mode', () => {
  beforeEach(() => {
    cache.flushAll();
    delete process.env.PTV_API_KEY;
  });

  it('returns empty alerts when API key is missing', async () => {
    const alerts = await gtfsRealtime.getMetroAlerts();
    expect(alerts).toEqual([]);
  });

  it('returns empty tram alerts when API key is missing', async () => {
    const alerts = await gtfsRealtime.getTramAlerts();
    expect(alerts).toEqual([]);
  });

  it('returns empty delays when API key is missing', async () => {
    const delays = await gtfsRealtime.getActiveDelays();
    expect(delays).toEqual([]);
  });

  it('supports repeated demo-mode calls without throwing', async () => {
    await expect(gtfsRealtime.getMetroAlerts()).resolves.toEqual([]);
    cache.flushAll();
    await expect(gtfsRealtime.getMetroTripUpdates()).resolves.toEqual([]);
  });
});
