import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { detectNearMiss } = require('../../src/services/nearMissDetector');

describe('near miss detector', () => {
  it('triggers when risk jumps by 20+ in 15 minutes', () => {
    const result = detectNearMiss({
      currentSnapshot: {
        timestamp: new Date().toISOString(),
        lineId: 'frankston',
        risk: 68,
        activeDelayCount: 2,
      },
      previousSnapshots: [{
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        lineId: 'frankston',
        risk: 42,
        activeDelayCount: 1,
      }],
      lineGroupAlerts: 0,
      weatherRisk: 0.2,
    });

    expect(result.isNearMiss).toBe(true);
  });

  it('triggers for high weather risk and elevated line risk', () => {
    const result = detectNearMiss({
      currentSnapshot: {
        timestamp: new Date().toISOString(),
        lineId: 'frankston',
        risk: 50,
        activeDelayCount: 0,
      },
      previousSnapshots: [],
      lineGroupAlerts: 0,
      weatherRisk: 0.8,
    });

    expect(result.isNearMiss).toBe(true);
  });

  it('does not trigger when stable', () => {
    const result = detectNearMiss({
      currentSnapshot: {
        timestamp: new Date().toISOString(),
        lineId: 'frankston',
        risk: 30,
        activeDelayCount: 1,
      },
      previousSnapshots: [{
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        lineId: 'frankston',
        risk: 28,
        activeDelayCount: 1,
      }],
      lineGroupAlerts: 0,
      weatherRisk: 0.1,
    });

    expect(result.isNearMiss).toBe(false);
  });
});
