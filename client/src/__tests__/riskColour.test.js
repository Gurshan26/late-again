import { describe, it, expect } from 'vitest';
import { riskColour, riskLabel } from '../utils/riskColour';

describe('riskColour', () => {
  it('returns teal for score < 30', () => {
    expect(riskColour(0)).toContain('212, 170');
    expect(riskColour(20)).toContain('212, 170');
  });

  it('returns amber for score 50-64', () => {
    expect(riskColour(55)).toContain('255, 170, 0');
  });

  it('returns red for score >= 80', () => {
    expect(riskColour(85)).toContain('255, 60, 60');
  });

  it('returns grey for null', () => {
    expect(riskColour(null)).toContain('122, 130, 153');
  });

  it('respects alpha parameter', () => {
    expect(riskColour(10, 0.5)).toContain('0.5');
  });
});

describe('riskLabel', () => {
  it('LOW RISK for score < 30', () => {
    expect(riskLabel(10)).toBe('LOW RISK');
  });

  it('MODERATE for score 50-64', () => {
    expect(riskLabel(60)).toBe('MODERATE');
  });

  it('SEVERE for score >= 80', () => {
    expect(riskLabel(90)).toBe('SEVERE');
  });

  it('UNKNOWN for null', () => {
    expect(riskLabel(null)).toBe('UNKNOWN');
  });
});
