import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  classifyAlert,
  classifyCategory,
  classifySeverity,
  isPlanned,
} = require('../../src/services/alertClassifier');

function buildRawAlert(text) {
  return {
    id: 'a1',
    mode: 'metro',
    alert: {
      effect: 7,
      informedEntity: [{ routeId: '5', stopId: '123' }],
      headerText: { translation: [{ text }] },
      descriptionText: { translation: [{ text }] },
      activePeriod: [],
    },
  };
}

describe('alert classifier', () => {
  it('classifies car park closure as minor station facility', () => {
    const alert = classifyAlert(buildRawAlert('Frankston station car park closure until further notice'));
    expect(alert.severity).toBe('minor');
    expect(alert.category).toBe('station_facility');
    expect(alert.facilityOnly).toBe(true);
  });

  it('classifies replacement buses as major replacement_bus', () => {
    const alert = classifyAlert(buildRawAlert('Buses replace trains between Caulfield and South Yarra'));
    expect(alert.severity).toBe('major');
    expect(alert.category).toBe('replacement_bus');
  });

  it('classifies suspended/no trains as critical', () => {
    const severity = classifySeverity('No trains are running. Services suspended due to emergency services request.', 1);
    expect(severity).toBe('critical');
  });

  it('classifies allow extra travel time as moderate', () => {
    const severity = classifySeverity('Delays expected, allow extra travel time', 2);
    expect(severity).toBe('moderate');
    expect(classifyCategory('Delays expected, allow extra travel time')).toBe('delay');
  });

  it('detects planned works', () => {
    expect(isPlanned('Planned works this weekend with modified timetable')).toBe(true);
    const alert = classifyAlert(buildRawAlert('Planned works this weekend with modified timetable'));
    expect(alert.planned).toBe(true);
  });
});
