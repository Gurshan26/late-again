import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildRiskExplanation } = require('../../src/services/riskExplanation');

describe('risk explanation', () => {
  it('includes baseline, live delay, weather, and alert factors', () => {
    const explanation = buildRiskExplanation({
      lineId: 'frankston',
      datetime: new Date('2026-04-24T08:00:00+10:00'),
      baselinePoints: 23,
      liveDelayPoints: 12,
      weatherPoints: 8,
      alertPoints: 15,
      alertSeverity: 'major',
      activeDelaySeconds: 600,
      weatherRisk: 0.4,
      hasAlert: true,
    });

    expect(explanation.breakdown).toHaveLength(4);
    expect(explanation.breakdown.map((item) => item.factor)).toEqual([
      'Peak hour baseline',
      'Live delays',
      'Weather',
      'Alert severity',
    ]);
  });

  it('total equals sum of points (capped)', () => {
    const explanation = buildRiskExplanation({
      lineId: 'frankston',
      datetime: new Date('2026-04-24T08:00:00+10:00'),
      baselinePoints: 20,
      liveDelayPoints: 10,
      weatherPoints: 10,
      alertPoints: 10,
      alertSeverity: 'major',
      activeDelaySeconds: 300,
      weatherRisk: 0.5,
      hasAlert: true,
    });

    expect(explanation.total).toBe(50);
  });

  it('all explanations are human-readable strings', () => {
    const explanation = buildRiskExplanation({
      lineId: 'frankston',
      datetime: new Date(),
      baselinePoints: 10,
      liveDelayPoints: 0,
      weatherPoints: 0,
      alertPoints: 0,
      alertSeverity: null,
      activeDelaySeconds: 0,
      weatherRisk: 0,
      hasAlert: false,
    });

    explanation.breakdown.forEach((item) => {
      expect(typeof item.explanation).toBe('string');
      expect(item.explanation.length).toBeGreaterThan(5);
    });
  });
});
