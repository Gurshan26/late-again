import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
process.env.NODE_ENV = 'test';
process.env.PTV_API_KEY = 'test-key';

const gtfsRealtime = require('../src/services/gtfsRealtime');
const weatherService = require('../src/services/weather');
const plannerService = require('../src/services/planner');

gtfsRealtime.getMetroAlerts = vi.fn().mockResolvedValue([
  {
    id: 'metro-1',
    alert: {
      effect: 3,
      informedEntity: [{ routeId: '5' }],
      headerText: { translation: [{ text: 'Significant delays on Frankston line' }] },
      descriptionText: { translation: [{ text: 'Allow extra travel time' }] },
      activePeriod: [],
    },
  },
]);
gtfsRealtime.getTramAlerts = vi.fn().mockResolvedValue([]);
gtfsRealtime.getActiveDelays = vi.fn().mockResolvedValue([
  { routeId: '5', stopId: '1', delaySeconds: 300, tripId: 't1' },
]);
gtfsRealtime.getMetroTripUpdates = vi.fn().mockResolvedValue([]);

weatherService.getWeatherForecast = vi.fn().mockResolvedValue({
  hourly: {
    time: ['2025-06-10T08:00'],
    precipitation: [0],
    wind_speed_10m: [0],
    weather_code: [0],
    temperature_2m: [15],
  },
  timezone: 'Australia/Melbourne',
});
weatherService.weatherRiskFactor = vi.fn().mockReturnValue(0.2);
weatherService.toMelbourneHourString = vi.fn().mockReturnValue('2025-06-10T08:00');

plannerService.getPlannerIndex = vi.fn().mockResolvedValue({});
plannerService.searchStations = vi.fn().mockReturnValue([
  {
    id: 'vic:rail:FKN',
    name: 'Frankston Station',
    lat: -38.1437,
    lon: 145.1256,
    modes: ['metro'],
  },
]);
plannerService.findJourneyOptions = vi.fn().mockReturnValue({
  query: {
    originId: 'vic:rail:FKN',
    destinationId: 'vic:rail:FS',
    date: '2025-06-10',
    time: '08:10',
    timeMode: 'depart',
    timezone: 'Australia/Melbourne',
  },
  options: [
    {
      id: 'opt-1',
      departureTime: '2025-06-10T08:12',
      arrivalTime: '2025-06-10T09:02',
      durationMinutes: 50,
      transferCount: 0,
      walkMinutes: 2,
      legs: [],
      involvedLineIds: ['frankston'],
      primaryLineId: 'frankston',
      maxAlertSeverity: 'moderate',
      riskScore: 62,
      riskLabel: 'MODERATE',
      score: 71,
    },
  ],
  partialSearch: false,
  emptyReason: null,
});

const app = require('../src/index');

describe('GET /health', () => {
  it('returns 200 and ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('GET /api/lines', () => {
  it('returns array of lines', async () => {
    const res = await request(app).get('/api/lines');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.lines)).toBe(true);
    expect(res.body.lines.length).toBe(16);
  });
});

describe('GET /api/alerts', () => {
  it('returns classified ranked alerts with summary and health', async () => {
    const res = await request(app).get('/api/alerts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.alerts)).toBe(true);
    expect(Array.isArray(res.body.metro)).toBe(true);
    expect(res.body.summary).toBeDefined();
    expect(res.body.dataHealth).toBeDefined();
    expect(res.body.alerts[0]).toHaveProperty('severity');
  });
});

describe('GET /api/delays', () => {
  it('returns byLine object and health', async () => {
    const res = await request(app).get('/api/delays');
    expect(res.status).toBe(200);
    expect(res.body.byLine).toBeDefined();
    expect(res.body.dataHealth).toBeDefined();
  });
});

describe('GET /api/predict/:lineId', () => {
  it('returns risk, explanation, recommendation, health, nearMiss', async () => {
    const res = await request(app).get('/api/predict/frankston');
    expect(res.status).toBe(200);
    expect(res.body.lineId).toBe('frankston');
    expect(typeof res.body.currentRisk).toBe('number');
    expect(res.body.explanation).toBeDefined();
    expect(res.body.recommendation).toBeDefined();
    expect(res.body.dataHealth).toBeDefined();
    expect(res.body.nearMiss).toBeDefined();
  });

  it('accepts trip profile query params', async () => {
    const res = await request(app)
      .get('/api/predict/frankston')
      .query({
        origin: 'Frankston',
        destination: 'Flinders Street',
        bufferMinutes: 12,
      });

    expect(res.status).toBe(200);
    expect(res.body.recommendation).toHaveProperty('action');
  });
});

describe('GET /api/commute/impact', () => {
  it('returns commute impact decision payload', async () => {
    const res = await request(app)
      .get('/api/commute/impact')
      .query({
        lineId: 'frankston',
        origin: 'Frankston',
        destination: 'Flinders Street',
        bufferMinutes: 12,
      });

    expect(res.status).toBe(200);
    expect(res.body.headline).toBeDefined();
    expect(res.body.recommendation).toBeDefined();
    expect(res.body.risk).toBeDefined();
    expect(res.body.dataHealth).toBeDefined();
  });
});

describe('GET /api/planner/stations', () => {
  it('returns strict station matches', async () => {
    const res = await request(app).get('/api/planner/stations').query({ query: 'Frank' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.stations)).toBe(true);
    expect(res.body.total).toBeGreaterThan(0);
  });
});

describe('GET /api/planner/options', () => {
  it('returns journey options payload', async () => {
    const res = await request(app).get('/api/planner/options').query({
      originId: 'vic:rail:FKN',
      destinationId: 'vic:rail:FS',
      date: '2025-06-10',
      time: '08:10',
      timeMode: 'depart',
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.options)).toBe(true);
    expect(res.body.options[0]).toHaveProperty('recommendation');
    expect(res.body).toHaveProperty('dataHealth');
  });

  it('returns 400 for missing required query', async () => {
    const res = await request(app).get('/api/planner/options').query({
      originId: 'vic:rail:FKN',
    });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/weather', () => {
  it('returns current and next24h', async () => {
    const res = await request(app).get('/api/weather');
    expect(res.status).toBe(200);
    expect(res.body.current).toBeDefined();
    expect(res.body.next24h).toBeDefined();
    expect(res.body.dataHealth).toBeDefined();
  });
});

describe('Error handling', () => {
  it('returns 404 for unknown route', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });
});
