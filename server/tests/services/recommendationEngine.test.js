import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildRecommendation } = require('../../src/services/recommendationEngine');

const base = {
  lineId: 'frankston',
  riskScore: 40,
  riskLabel: 'MODERATE',
  alertSeverity: null,
  alertCategory: null,
  activeDelaySeconds: 0,
  weatherRisk: 0,
  datetime: new Date('2026-04-24T08:00:00+10:00'),
  dataHealth: { status: 'live' },
  tripProfile: null,
};

describe('recommendation engine', () => {
  it('returns avoid for very high risk', () => {
    const rec = buildRecommendation({ ...base, riskScore: 85 });
    expect(rec.action).toBe('avoid');
  });

  it('returns leave_early for 65+', () => {
    const rec = buildRecommendation({ ...base, riskScore: 70 });
    expect(rec.action).toBe('leave_early');
    expect(rec.extraMinutes).toBeGreaterThanOrEqual(20);
  });

  it('returns unknown_live_data for demo mode', () => {
    const rec = buildRecommendation({ ...base, dataHealth: { status: 'demo' }, riskScore: 10 });
    expect(rec.action).toBe('unknown_live_data');
  });

  it('returns reroute for replacement bus alert', () => {
    const rec = buildRecommendation({ ...base, alertCategory: 'replacement_bus', riskScore: 20 });
    expect(rec.action).toBe('reroute');
  });

  it('reduces confidence for stale data', () => {
    const live = buildRecommendation({ ...base, dataHealth: { status: 'live' }, riskScore: 45 });
    const stale = buildRecommendation({ ...base, dataHealth: { status: 'stale' }, riskScore: 45 });
    expect(stale.confidence).toBeLessThan(live.confidence);
  });

  it('trip buffer increases extra minutes', () => {
    const rec = buildRecommendation({
      ...base,
      riskScore: 55,
      tripProfile: { bufferMinutes: 18 },
    });
    expect(rec.action).toBe('leave_early');
    expect(rec.extraMinutes).toBeGreaterThanOrEqual(18);
  });
});
