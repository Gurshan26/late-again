const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
const fetch = require('node-fetch');
const cache = require('./cache');
const { markSuccess, markFailure } = require('./dataHealth');

const BASE_URL = 'https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1';

const FEEDS = {
  metroAlerts: `${BASE_URL}/metro/service-alerts`,
  metroTripUpdates: `${BASE_URL}/metro/trip-updates`,
  tramAlerts: `${BASE_URL}/tram/service-alerts`,
};

let warnedMissingKey = false;

function getApiKey() {
  return process.env.PTV_API_KEY;
}

function warnMissingKeyOnce() {
  if (warnedMissingKey) return;
  console.warn('[WARN] PTV_API_KEY not set — running in demo mode with no live PTV data');
  warnedMissingKey = true;
}

async function fetchFeed(url, cacheKey) {
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const API_KEY = getApiKey();
  if (!API_KEY) {
    warnMissingKeyOnce();
    return [];
  }

  try {
    const response = await fetch(url, {
      headers: { KeyID: API_KEY },
    });

    if (!response.ok) {
      throw new Error(`PTV API error: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.buffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buffer);
    const result = feed.entity || [];

    cache.set(cacheKey, result, 60);
    cache.set(`${cacheKey}_stale`, result, 600);
    markSuccess('ptv');
    return result;
  } catch (err) {
    markFailure('ptv', err);
    const stale = cache.get(`${cacheKey}_stale`);
    if (stale) return stale;
    return cached || [];
  }
}

async function getMetroAlerts() {
  return fetchFeed(FEEDS.metroAlerts, 'metro_alerts');
}

async function getMetroTripUpdates() {
  return fetchFeed(FEEDS.metroTripUpdates, 'metro_trips');
}

async function getTramAlerts() {
  return fetchFeed(FEEDS.tramAlerts, 'tram_alerts');
}

async function getActiveDelays() {
  const updates = await getMetroTripUpdates();
  const delays = [];

  for (const entity of updates) {
    const tripUpdate = entity.tripUpdate;
    if (!tripUpdate) continue;

    const routeId = tripUpdate.trip && tripUpdate.trip.routeId ? tripUpdate.trip.routeId : 'unknown';

    for (const stopTimeUpdate of tripUpdate.stopTimeUpdate || []) {
      const delaySeconds =
        (stopTimeUpdate.departure && stopTimeUpdate.departure.delay) ??
        (stopTimeUpdate.arrival && stopTimeUpdate.arrival.delay) ??
        0;

      if (delaySeconds > 60) {
        delays.push({
          routeId,
          stopId: stopTimeUpdate.stopId,
          delaySeconds,
          tripId: tripUpdate.trip && tripUpdate.trip.tripId ? tripUpdate.trip.tripId : undefined,
        });
      }
    }
  }

  return delays;
}

module.exports = {
  getMetroAlerts,
  getMetroTripUpdates,
  getTramAlerts,
  getActiveDelays,
};
