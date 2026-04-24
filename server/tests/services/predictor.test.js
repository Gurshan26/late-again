import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  predictDelayRisk,
  predict24hProfile,
  getTimePeriod,
} = require('../../src/services/predictor');

describe('getTimePeriod', () => {
  it('returns peak for 8am weekday', () => {
    expect(getTimePeriod(8, 1)).toBe('peak');
  });

  it('returns peak for 5pm weekday', () => {
    expect(getTimePeriod(17, 3)).toBe('peak');
  });

  it('returns offpeak for 11am weekday', () => {
    expect(getTimePeriod(11, 2)).toBe('offpeak');
  });

  it('returns weekend for Saturday', () => {
    expect(getTimePeriod(8, 6)).toBe('weekend');
  });

  it('returns weekend for Sunday', () => {
    expect(getTimePeriod(17, 0)).toBe('weekend');
  });
});

describe('predictDelayRisk', () => {
  const base = {
    lineId: 'frankston',
    datetime: new Date('2025-06-10T08:00:00+10:00'),
    activeDelaySeconds: 0,
    hasAlert: false,
    weatherRisk: 0,
  };

  it('returns a number between 0 and 100', () => {
    const score = predictDelayRisk(base);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('peak score is higher than offpeak', () => {
    const peak = predictDelayRisk({ ...base, datetime: new Date('2025-06-10T08:00:00+10:00') });
    const offpeak = predictDelayRisk({ ...base, datetime: new Date('2025-06-10T11:00:00+10:00') });
    expect(peak).toBeGreaterThan(offpeak);
  });

  it('alert increases score', () => {
    const noAlert = predictDelayRisk(base);
    const withAlert = predictDelayRisk({ ...base, hasAlert: true });
    expect(withAlert).toBeGreaterThan(noAlert);
  });

  it('weather risk increases score', () => {
    const clear = predictDelayRisk(base);
    const storm = predictDelayRisk({ ...base, weatherRisk: 0.8 });
    expect(storm).toBeGreaterThan(clear);
  });

  it('active delays increase score', () => {
    const noDelay = predictDelayRisk(base);
    const delayed = predictDelayRisk({ ...base, activeDelaySeconds: 600 });
    expect(delayed).toBeGreaterThan(noDelay);
  });

  it('caps at 100 under worst conditions', () => {
    const worst = predictDelayRisk({
      ...base,
      activeDelaySeconds: 9999,
      hasAlert: true,
      weatherRisk: 1,
    });
    expect(worst).toBeLessThanOrEqual(100);
  });

  it('unknown line falls back to defaults without crashing', () => {
    expect(() => predictDelayRisk({ ...base, lineId: 'nonexistent' })).not.toThrow();
  });

  it('weekend is lower risk than peak', () => {
    const weekday = predictDelayRisk({ ...base, datetime: new Date('2025-06-09T08:00:00+10:00') });
    const weekend = predictDelayRisk({ ...base, datetime: new Date('2025-06-14T08:00:00+10:00') });
    expect(weekday).toBeGreaterThan(weekend);
  });
});

describe('predict24hProfile', () => {
  it('returns 24 entries', () => {
    const profile = predict24hProfile('frankston', new Date(), null, false);
    expect(profile).toHaveLength(24);
  });

  it('each entry has hour and risk', () => {
    const profile = predict24hProfile('frankston', new Date(), null, false);
    profile.forEach((entry) => {
      expect(entry).toHaveProperty('hour');
      expect(entry).toHaveProperty('risk');
      expect(entry.risk).toBeGreaterThanOrEqual(0);
      expect(entry.risk).toBeLessThanOrEqual(100);
    });
  });

  it('hours are 0 through 23', () => {
    const profile = predict24hProfile('frankston', new Date(), null, false);
    profile.forEach((entry, index) => {
      expect(entry.hour).toBe(index);
    });
  });
});
