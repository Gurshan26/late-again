import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { weatherRiskFactor } = require('../../src/services/weather');

const mockHourly = {
  time: ['2025-06-10T08:00', '2025-06-10T09:00', '2025-06-10T10:00'],
  precipitation: [0, 15, 0],
  wind_speed_10m: [10, 60, 25],
  weather_code: [0, 95, 2],
};

describe('weatherRiskFactor', () => {
  it('returns 0 for hour not in data', () => {
    expect(weatherRiskFactor(mockHourly, '2030-01-01T00:00')).toBe(0);
  });

  it('returns 0 for clear weather', () => {
    const risk = weatherRiskFactor(mockHourly, '2025-06-10T08:00');
    expect(risk).toBe(0);
  });

  it('returns high risk for storm + heavy rain + wind', () => {
    const risk = weatherRiskFactor(mockHourly, '2025-06-10T09:00');
    expect(risk).toBeGreaterThan(0.5);
  });

  it('never exceeds 1', () => {
    const risk = weatherRiskFactor(mockHourly, '2025-06-10T09:00');
    expect(risk).toBeLessThanOrEqual(1);
  });

  it('never goes below 0', () => {
    const risk = weatherRiskFactor(mockHourly, '2025-06-10T08:00');
    expect(risk).toBeGreaterThanOrEqual(0);
  });
});
