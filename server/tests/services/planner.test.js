import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  buildPlannerIndex,
  searchStations,
  findJourneyOptions,
} = require('../../src/services/planner');

const mockGtfs = {
  routes: [
    {
      route_id: 'R1',
      route_short_name: 'Frankston',
      route_long_name: 'Frankston - City',
    },
    {
      route_id: 'R2',
      route_short_name: 'Belgrave',
      route_long_name: 'Belgrave - City',
    },
  ],
  trips: [
    {
      route_id: 'R1',
      service_id: 'WK',
      trip_id: 'T1',
      trip_headsign: 'Bravo',
      direction_id: '0',
    },
    {
      route_id: 'R2',
      service_id: 'WK',
      trip_id: 'T2',
      trip_headsign: 'Central',
      direction_id: '0',
    },
    {
      route_id: 'R1',
      service_id: 'WK',
      trip_id: 'T3',
      trip_headsign: 'Central',
      direction_id: '0',
    },
  ],
  stopTimes: [
    // Transfer path A -> B (T1), walk B -> D, D -> C (T2)
    { trip_id: 'T1', arrival_time: '08:00:00', departure_time: '08:00:00', stop_id: 'A1', stop_sequence: '1' },
    { trip_id: 'T1', arrival_time: '08:15:00', departure_time: '08:15:00', stop_id: 'B1', stop_sequence: '2' },
    { trip_id: 'T2', arrival_time: '08:20:00', departure_time: '08:20:00', stop_id: 'D1', stop_sequence: '1' },
    { trip_id: 'T2', arrival_time: '08:35:00', departure_time: '08:35:00', stop_id: 'C1', stop_sequence: '2' },

    // Direct option A -> C
    { trip_id: 'T3', arrival_time: '09:00:00', departure_time: '09:00:00', stop_id: 'A2', stop_sequence: '1' },
    { trip_id: 'T3', arrival_time: '09:30:00', departure_time: '09:30:00', stop_id: 'C1', stop_sequence: '2' },
  ],
  stops: [
    { stop_id: 'A1', stop_name: 'Alpha Station Platform 1', stop_lat: '-37.8000', stop_lon: '144.9000', parent_station: 'STA' },
    { stop_id: 'A2', stop_name: 'Alpha Station Platform 2', stop_lat: '-37.8001', stop_lon: '144.9001', parent_station: 'STA' },
    { stop_id: 'B1', stop_name: 'Bravo Station', stop_lat: '-37.8100', stop_lon: '144.9100', parent_station: 'STB' },
    { stop_id: 'D1', stop_name: 'Delta Interchange', stop_lat: '-37.8102', stop_lon: '144.9102', parent_station: 'STD' },
    { stop_id: 'C1', stop_name: 'Central Station', stop_lat: '-37.8200', stop_lon: '144.9200', parent_station: 'STC' },
  ],
  calendar: [
    {
      service_id: 'WK',
      monday: '1',
      tuesday: '1',
      wednesday: '1',
      thursday: '1',
      friday: '1',
      saturday: '0',
      sunday: '0',
      start_date: '20260101',
      end_date: '20261231',
    },
  ],
  calendarDates: [],
};

const lineContext = {
  frankston: { riskScore: 58, maxAlertSeverity: 'moderate' },
  belgrave: { riskScore: 22, maxAlertSeverity: 'info' },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('planner index and search', () => {
  it('deduplicates parent/platform stops into canonical stations', () => {
    const index = buildPlannerIndex(mockGtfs);
    const stations = searchStations(index, 'alpha', 10);

    expect(stations).toHaveLength(1);
    expect(stations[0].id).toBe('STA');
  });

  it('rejects invalid station IDs', () => {
    const index = buildPlannerIndex(mockGtfs);

    expect(() => findJourneyOptions({
      index,
      originId: 'INVALID',
      destinationId: 'STC',
      date: '2026-04-24',
      time: '08:00',
      timeMode: 'depart',
      lineContextById: lineContext,
    })).toThrow('Invalid originId');
  });

  it('returns direct options when available', () => {
    const index = buildPlannerIndex(mockGtfs);
    const result = findJourneyOptions({
      index,
      originId: 'STA',
      destinationId: 'STC',
      date: '2026-04-24',
      time: '08:50',
      timeMode: 'depart',
      lineContextById: lineContext,
    });

    expect(result.options.length).toBeGreaterThan(0);
    expect(result.options.some((option) => option.transferCount === 0)).toBe(true);
  });

  it('returns transfer options with walking legs', () => {
    const index = buildPlannerIndex(mockGtfs);
    const result = findJourneyOptions({
      index,
      originId: 'STA',
      destinationId: 'STC',
      date: '2026-04-24',
      time: '08:00',
      timeMode: 'depart',
      lineContextById: lineContext,
    });

    const transferOption = result.options.find((option) => option.transferCount >= 1);
    expect(transferOption).toBeDefined();
    expect(transferOption.walkMinutes).toBeGreaterThan(0);
  });

  it('supports depart and arrive modes correctly', () => {
    const index = buildPlannerIndex(mockGtfs);

    const depart = findJourneyOptions({
      index,
      originId: 'STA',
      destinationId: 'STC',
      date: '2026-04-24',
      time: '08:00',
      timeMode: 'depart',
      lineContextById: lineContext,
    });
    expect(depart.options.length).toBeGreaterThan(0);

    const arrive = findJourneyOptions({
      index,
      originId: 'STA',
      destinationId: 'STC',
      date: '2026-04-24',
      time: '08:36',
      timeMode: 'arrive',
      lineContextById: lineContext,
    });

    expect(arrive.options.length).toBeGreaterThan(0);
    for (const option of arrive.options) {
      const arrival = option.arrivalTime.split('T')[1];
      expect(arrival <= '08:36').toBe(true);
    }
  });

  it('returns options sorted by best score', () => {
    const index = buildPlannerIndex(mockGtfs);
    const result = findJourneyOptions({
      index,
      originId: 'STA',
      destinationId: 'STC',
      date: '2026-04-24',
      time: '08:00',
      timeMode: 'depart',
      lineContextById: lineContext,
    });

    const scores = result.options.map((option) => option.score);
    const sorted = [...scores].sort((a, b) => a - b);
    expect(scores).toEqual(sorted);
  });

  it('flags partialSearch when search budget is exceeded', () => {
    const index = buildPlannerIndex(mockGtfs);
    let calls = 0;

    vi.spyOn(Date, 'now').mockImplementation(() => {
      calls += 1;
      return calls === 1 ? 0 : 5000;
    });

    const result = findJourneyOptions({
      index,
      originId: 'STA',
      destinationId: 'STC',
      date: '2026-04-24',
      time: '08:00',
      timeMode: 'depart',
      lineContextById: lineContext,
    });

    expect(result.partialSearch).toBe(true);
  });
});
