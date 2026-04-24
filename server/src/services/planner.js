const lines = require('../data/lines.json');
const { loadGtfsStaticData } = require('./gtfsStatic');
const { scoreLabel } = require('./riskExplanation');

const TIMEZONE = 'Australia/Melbourne';
const SEARCH_HORIZON_SECONDS = 180 * 60;
const TRANSFER_RADIUS_METERS = 450;
const WALK_SPEED_M_PER_S = (4.8 * 1000) / 3600;
const MIN_INTERCHANGE_SECONDS = 120;
const MAX_TRANSFERS = 4;
const MAX_OPTIONS_DEFAULT = 6;
const SEARCH_BUDGET_MS = 1200;
const MAX_DEPARTURES_PER_STATE = 10;

const DISRUPTION_PENALTY = {
  critical: 20,
  major: 14,
  moderate: 8,
  minor: 3,
  info: 0,
};

const DAY_COLUMNS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

const LINE_NAME_TO_ID = new Map(
  lines.map((line) => [normalizeText(line.name), line.id]),
);

let plannerIndexPromise = null;
let plannerIndex = null;

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseGtfsTime(value) {
  if (!value) return null;
  const [hh, mm, ss] = String(value).split(':').map(Number);
  if ([hh, mm, ss].some((part) => Number.isNaN(part))) return null;
  return (hh * 3600) + (mm * 60) + ss;
}

function parseLatLon(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stationNameScore(name) {
  const normalized = normalizeText(name);
  let score = 0;

  if (normalized.includes('station')) score += 5;
  if (normalized.includes('rail')) score += 1;
  if (normalized.includes('platform')) score -= 2;
  if (normalized.includes('replacement bus')) score -= 8;
  score -= Math.min(String(name).length / 120, 2);

  return score;
}

function haversineMeters(aLat, aLon, bLat, bLon) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const r = 6371000;
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const x = (s1 * s1)
    + (Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * s2 * s2);
  return 2 * r * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function inferLineId(route) {
  const shortName = normalizeText(route.route_short_name);
  if (LINE_NAME_TO_ID.has(shortName)) return LINE_NAME_TO_ID.get(shortName);

  const longName = normalizeText(route.route_long_name);
  for (const [name, lineId] of LINE_NAME_TO_ID.entries()) {
    if (longName.includes(name)) return lineId;
  }

  return null;
}

function routeName(route) {
  return route.route_short_name
    || route.route_long_name
    || route.route_id;
}

function buildStations(stops) {
  const stationsById = new Map();
  const stopToStationId = new Map();

  for (const stop of stops) {
    const stopId = String(stop.stop_id || '').trim();
    if (!stopId) continue;

    const canonicalId = String(stop.parent_station || stopId).trim();
    const stopName = String(stop.stop_name || canonicalId).trim();
    const lat = parseLatLon(stop.stop_lat);
    const lon = parseLatLon(stop.stop_lon);

    if (!stationsById.has(canonicalId)) {
      stationsById.set(canonicalId, {
        id: canonicalId,
        name: stopName,
        lat,
        lon,
        stopIds: new Set(),
        modes: ['metro'],
        searchName: normalizeText(stopName),
      });
    }

    const station = stationsById.get(canonicalId);
    station.stopIds.add(stopId);

    if (stationNameScore(stopName) > stationNameScore(station.name)) {
      station.name = stopName;
      station.searchName = normalizeText(stopName);
    }

    if (!Number.isFinite(station.lat) || station.lat === 0) station.lat = lat;
    if (!Number.isFinite(station.lon) || station.lon === 0) station.lon = lon;

    stopToStationId.set(stopId, canonicalId);
  }

  return { stationsById, stopToStationId };
}

function buildRoutes(routes) {
  const routesById = new Map();

  for (const route of routes) {
    const id = String(route.route_id || '').trim();
    if (!id) continue;

    const name = routeName(route);
    const isReplacement = /replacement bus/i.test(name)
      || /-R:?$/i.test(id);

    routesById.set(id, {
      id,
      name,
      shortName: route.route_short_name || '',
      longName: route.route_long_name || '',
      lineId: inferLineId(route),
      isReplacement,
    });
  }

  return routesById;
}

function buildTrips(trips, routesById) {
  const tripsById = new Map();

  for (const trip of trips) {
    const tripId = String(trip.trip_id || '').trim();
    if (!tripId) continue;

    const routeId = String(trip.route_id || '').trim();
    const route = routesById.get(routeId);

    tripsById.set(tripId, {
      id: tripId,
      routeId,
      serviceId: String(trip.service_id || '').trim(),
      directionId: Number(trip.direction_id || 0),
      headsign: trip.trip_headsign || '',
      routeName: route ? route.name : routeId,
      lineId: route ? route.lineId : null,
      isReplacement: route ? route.isReplacement : false,
    });
  }

  return tripsById;
}

function buildTripStopTimes(stopTimes, stopToStationId) {
  const tripStopsByTripId = new Map();

  for (const entry of stopTimes) {
    const tripId = String(entry.trip_id || '').trim();
    if (!tripId) continue;

    const stopId = String(entry.stop_id || '').trim();
    const stationId = stopToStationId.get(stopId) || stopId;
    const arrivalSec = parseGtfsTime(entry.arrival_time);
    const departureSec = parseGtfsTime(entry.departure_time);
    const sequence = Number(entry.stop_sequence || 0);

    if (!tripStopsByTripId.has(tripId)) {
      tripStopsByTripId.set(tripId, []);
    }

    tripStopsByTripId.get(tripId).push({
      stopId,
      stationId,
      sequence,
      arrivalSec,
      departureSec,
    });
  }

  for (const stops of tripStopsByTripId.values()) {
    stops.sort((a, b) => a.sequence - b.sequence);
  }

  return tripStopsByTripId;
}

function buildDeparturesByStation(tripsById, tripStopsByTripId) {
  const departuresByStationId = new Map();

  for (const [tripId, stops] of tripStopsByTripId.entries()) {
    const trip = tripsById.get(tripId);
    if (!trip) continue;

    for (let idx = 0; idx < stops.length; idx += 1) {
      const stop = stops[idx];
      if (!Number.isFinite(stop.departureSec)) continue;

      if (!departuresByStationId.has(stop.stationId)) {
        departuresByStationId.set(stop.stationId, []);
      }

      departuresByStationId.get(stop.stationId).push({
        tripId,
        stationId: stop.stationId,
        departureSec: stop.departureSec,
        stopIndex: idx,
        serviceId: trip.serviceId,
        routeId: trip.routeId,
        lineId: trip.lineId,
        isReplacement: trip.isReplacement,
      });
    }
  }

  for (const departures of departuresByStationId.values()) {
    departures.sort((a, b) => a.departureSec - b.departureSec);
  }

  return departuresByStationId;
}

function buildNearbyTransfers(stationsById) {
  const stationList = Array.from(stationsById.values());
  const nearbyByStationId = new Map();

  for (const station of stationList) {
    nearbyByStationId.set(station.id, []);
  }

  for (let i = 0; i < stationList.length; i += 1) {
    const a = stationList[i];
    for (let j = i + 1; j < stationList.length; j += 1) {
      const b = stationList[j];

      const dist = haversineMeters(a.lat, a.lon, b.lat, b.lon);
      if (dist > TRANSFER_RADIUS_METERS) continue;

      const walkMinutes = dist / WALK_SPEED_M_PER_S / 60;
      nearbyByStationId.get(a.id).push({
        toStationId: b.id,
        distanceMeters: Math.round(dist),
        walkMinutes,
        walkSeconds: Math.ceil(walkMinutes * 60),
      });
      nearbyByStationId.get(b.id).push({
        toStationId: a.id,
        distanceMeters: Math.round(dist),
        walkMinutes,
        walkSeconds: Math.ceil(walkMinutes * 60),
      });
    }
  }

  for (const transfers of nearbyByStationId.values()) {
    transfers.sort((a, b) => a.walkSeconds - b.walkSeconds);
  }

  return nearbyByStationId;
}

function buildCalendar(calendar, calendarDates) {
  const calendarByServiceId = new Map();
  const exceptionsByServiceId = new Map();

  for (const entry of calendar) {
    const serviceId = String(entry.service_id || '').trim();
    if (!serviceId) continue;

    calendarByServiceId.set(serviceId, {
      startDate: Number(entry.start_date || 0),
      endDate: Number(entry.end_date || 0),
      days: {
        sunday: entry.sunday === '1',
        monday: entry.monday === '1',
        tuesday: entry.tuesday === '1',
        wednesday: entry.wednesday === '1',
        thursday: entry.thursday === '1',
        friday: entry.friday === '1',
        saturday: entry.saturday === '1',
      },
    });
  }

  for (const exception of calendarDates || []) {
    const serviceId = String(exception.service_id || '').trim();
    if (!serviceId) continue;

    if (!exceptionsByServiceId.has(serviceId)) {
      exceptionsByServiceId.set(serviceId, new Map());
    }

    const dateInt = Number(exception.date || 0);
    const exceptionType = Number(exception.exception_type || 0);
    if (dateInt > 0 && (exceptionType === 1 || exceptionType === 2)) {
      exceptionsByServiceId.get(serviceId).set(dateInt, exceptionType);
    }
  }

  return { calendarByServiceId, exceptionsByServiceId };
}

function toDateInt(dateKey) {
  return Number(String(dateKey || '').replace(/-/g, ''));
}

function dayIndexFromDateKey(dateKey) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  return date.getUTCDay();
}

function getActiveServicesForDate(index, dateKey) {
  if (index.activeServicesCache.has(dateKey)) {
    return index.activeServicesCache.get(dateKey);
  }

  const dateInt = toDateInt(dateKey);
  const dayColumn = DAY_COLUMNS[dayIndexFromDateKey(dateKey)];
  const active = new Set();

  for (const [serviceId, rule] of index.calendarByServiceId.entries()) {
    const inRange = dateInt >= rule.startDate && dateInt <= rule.endDate;
    if (!inRange || !rule.days[dayColumn]) continue;
    active.add(serviceId);
  }

  for (const [serviceId, exceptions] of index.exceptionsByServiceId.entries()) {
    const override = exceptions.get(dateInt);
    if (override === 1) active.add(serviceId);
    if (override === 2) active.delete(serviceId);
  }

  index.activeServicesCache.set(dateKey, active);
  return active;
}

function parseQueryDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD.');
  }
  return String(date);
}

function parseQueryTime(time) {
  if (!/^\d{2}:\d{2}$/.test(String(time || ''))) {
    throw new Error('Invalid time format. Expected HH:mm.');
  }

  const [hh, mm] = String(time).split(':').map(Number);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    throw new Error('Invalid time value.');
  }

  return (hh * 3600) + (mm * 60);
}

function addDays(dateKey, dayDelta) {
  const dt = new Date(`${dateKey}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + dayDelta);
  return dt.toISOString().slice(0, 10);
}

function formatDateTimeLocal(dateKey, seconds) {
  const dayOffset = Math.floor(seconds / 86400);
  const sec = ((seconds % 86400) + 86400) % 86400;
  const resolvedDate = addDays(dateKey, dayOffset);
  const hh = String(Math.floor(sec / 3600)).padStart(2, '0');
  const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  return `${resolvedDate}T${hh}:${mm}`;
}

function binarySearchDeparture(departures, minSec) {
  let lo = 0;
  let hi = departures.length;

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (departures[mid].departureSec < minSec) lo = mid + 1;
    else hi = mid;
  }

  return lo;
}

function createWalkLeg(index, fromStationId, toStationId, startSec, walkSeconds) {
  const fromStation = index.stationsById.get(fromStationId);
  const toStation = index.stationsById.get(toStationId);
  const endSec = startSec + walkSeconds;

  return {
    type: 'walk',
    mode: 'walk',
    fromStationId,
    fromStationName: fromStation ? fromStation.name : fromStationId,
    toStationId,
    toStationName: toStation ? toStation.name : toStationId,
    startSec,
    endSec,
    walkMinutes: Math.round((walkSeconds / 60) * 10) / 10,
  };
}

function createRideLeg(index, trip, fromStationId, toStationId, departureSec, arrivalSec) {
  const fromStation = index.stationsById.get(fromStationId);
  const toStation = index.stationsById.get(toStationId);

  return {
    type: 'ride',
    mode: trip.isReplacement ? 'replacement_bus' : 'metro',
    tripId: trip.id,
    routeId: trip.routeId,
    routeName: trip.routeName,
    lineId: trip.lineId,
    headsign: trip.headsign,
    fromStationId,
    fromStationName: fromStation ? fromStation.name : fromStationId,
    toStationId,
    toStationName: toStation ? toStation.name : toStationId,
    departureSec,
    arrivalSec,
    durationMinutes: Math.max(1, Math.round((arrivalSec - departureSec) / 60)),
  };
}

function firstLegStartSec(legs, fallback) {
  if (!legs.length) return fallback;
  const first = legs[0];
  if (first.type === 'ride') return first.departureSec;
  return first.startSec;
}

function buildOptionFromState({ state, originSec, dateKey }) {
  const rideLegs = state.legs.filter((leg) => leg.type === 'ride');
  if (!rideLegs.length) return null;

  const transferCount = Math.max(0, rideLegs.length - 1);
  const walkMinutes = state.legs
    .filter((leg) => leg.type === 'walk')
    .reduce((sum, leg) => sum + (leg.walkMinutes || 0), 0);
  const departSec = firstLegStartSec(state.legs, originSec);
  const arrivalSec = state.timeSec;
  const durationMinutes = Math.max(1, Math.round((arrivalSec - departSec) / 60));
  const involvedLineIds = Array.from(
    new Set(rideLegs.map((leg) => leg.lineId).filter(Boolean)),
  );
  const optionId = [
    departSec,
    arrivalSec,
    rideLegs.map((leg) => `${leg.routeId}:${leg.fromStationId}-${leg.toStationId}`).join('|'),
  ].join('::');

  return {
    id: optionId,
    departureSec: departSec,
    arrivalSec,
    departureTime: formatDateTimeLocal(dateKey, departSec),
    arrivalTime: formatDateTimeLocal(dateKey, arrivalSec),
    durationMinutes,
    transferCount,
    walkMinutes: Math.round(walkMinutes * 10) / 10,
    involvedLineIds,
    primaryLineId: involvedLineIds[0] || null,
    legs: state.legs.map((leg) => ({
      ...leg,
      ...(leg.type === 'ride'
        ? {
            departureTime: formatDateTimeLocal(dateKey, leg.departureSec),
            arrivalTime: formatDateTimeLocal(dateKey, leg.arrivalSec),
          }
        : {
            startTime: formatDateTimeLocal(dateKey, leg.startSec),
            endTime: formatDateTimeLocal(dateKey, leg.endSec),
          }),
    })),
  };
}

function calculateOptionScore(option, lineContextById) {
  const lineScores = option.involvedLineIds
    .map((lineId) => lineContextById[lineId] || null)
    .filter(Boolean);

  const riskScore = lineScores.length
    ? Math.round(
      lineScores.reduce((sum, line) => sum + (line.riskScore || 0), 0) / lineScores.length,
    )
    : 25;

  const severities = lineScores.map((line) => line.maxAlertSeverity || 'info');
  const severityOrder = ['info', 'minor', 'moderate', 'major', 'critical'];
  const maxSeverity = severities.sort(
    (a, b) => severityOrder.indexOf(b) - severityOrder.indexOf(a),
  )[0] || 'info';

  const reliabilityPenalty = Math.round((riskScore / 10) * 10) / 10;
  const disruptionPenalty = DISRUPTION_PENALTY[maxSeverity] ?? 0;
  const score = Math.round(
    (
      option.durationMinutes
      + (option.transferCount * 7)
      + option.walkMinutes
      + reliabilityPenalty
      + disruptionPenalty
    ) * 10,
  ) / 10;

  return {
    ...option,
    riskScore,
    riskLabel: scoreLabel(riskScore),
    maxAlertSeverity: maxSeverity,
    reliabilityPenalty,
    disruptionPenalty,
    score,
  };
}

function searchDepth({
  index,
  originId,
  destinationId,
  startSec,
  endSec,
  maxRides,
  activeServices,
  startMs,
  deadlineMs,
  timeMode,
  arriveBySec,
}) {
  const results = [];
  const seenOptions = new Set();
  const bestAtStation = new Map();
  const queue = [
    {
      stationId: originId,
      timeSec: startSec,
      rides: 0,
      legs: [],
      visitedStations: new Set([originId]),
    },
  ];

  while (queue.length > 0) {
    if ((Date.now() - startMs) > deadlineMs) {
      return { options: results, timedOut: true };
    }

    let minIdx = 0;
    for (let i = 1; i < queue.length; i += 1) {
      if (queue[i].timeSec < queue[minIdx].timeSec) minIdx = i;
    }

    const state = queue.splice(minIdx, 1)[0];
    if (state.timeSec > endSec) continue;

    if (state.stationId === destinationId && state.legs.length > 0) {
      const option = buildOptionFromState({
        state,
        originSec: startSec,
        dateKey: '1970-01-01', // patched by caller when formatting final output
      });

      if (option && (!arriveBySec || option.arrivalSec <= arriveBySec) && !seenOptions.has(option.id)) {
        seenOptions.add(option.id);
        results.push(option);
      }
      continue;
    }

    const bestKey = `${state.stationId}:${state.rides}`;
    const bestTime = bestAtStation.get(bestKey);
    if (bestTime !== undefined && state.timeSec > (bestTime + 30)) {
      continue;
    }
    bestAtStation.set(bestKey, state.timeSec);

    // Walking transfer edges.
    const nearby = index.nearbyByStationId.get(state.stationId) || [];
    for (const edge of nearby) {
      const nextTime = state.timeSec + edge.walkSeconds;
      if (nextTime > endSec) continue;
      if (state.visitedStations.has(edge.toStationId)) continue;

      const walkLeg = createWalkLeg(
        index,
        state.stationId,
        edge.toStationId,
        state.timeSec,
        edge.walkSeconds,
      );

      queue.push({
        stationId: edge.toStationId,
        timeSec: nextTime,
        rides: state.rides,
        legs: [...state.legs, walkLeg],
        visitedStations: new Set([...state.visitedStations, edge.toStationId]),
      });
    }

    if (state.rides >= maxRides) continue;

    // Boarding edges.
    const departures = index.departuresByStationId.get(state.stationId) || [];
    if (!departures.length) continue;

    const minBoardSec = state.timeSec + (state.rides > 0 ? MIN_INTERCHANGE_SECONDS : 0);
    const startIdx = binarySearchDeparture(departures, minBoardSec);

    let boarded = 0;
    for (let i = startIdx; i < departures.length; i += 1) {
      const departure = departures[i];
      if (departure.departureSec > endSec) break;
      if (!activeServices.has(departure.serviceId)) continue;

      boarded += 1;
      if (boarded > MAX_DEPARTURES_PER_STATE) break;

      const trip = index.tripsById.get(departure.tripId);
      const stops = index.tripStopsByTripId.get(departure.tripId) || [];
      if (!trip || !stops.length) continue;

      for (let j = departure.stopIndex + 1; j < stops.length; j += 1) {
        const nextStop = stops[j];
        const arrivalSec = Number.isFinite(nextStop.arrivalSec)
          ? nextStop.arrivalSec
          : nextStop.departureSec;
        if (!Number.isFinite(arrivalSec) || arrivalSec <= departure.departureSec) continue;
        if (arrivalSec > endSec) break;
        if (state.visitedStations.has(nextStop.stationId)) continue;

        const rideLeg = createRideLeg(
          index,
          trip,
          state.stationId,
          nextStop.stationId,
          departure.departureSec,
          arrivalSec,
        );

        const nextState = {
          stationId: nextStop.stationId,
          timeSec: arrivalSec,
          rides: state.rides + 1,
          legs: [...state.legs, rideLeg],
          visitedStations: new Set([...state.visitedStations, nextStop.stationId]),
        };

        if (nextStop.stationId === destinationId) {
          const option = buildOptionFromState({
            state: nextState,
            originSec: startSec,
            dateKey: '1970-01-01', // patched by caller when formatting final output
          });
          if (option && (!arriveBySec || option.arrivalSec <= arriveBySec) && !seenOptions.has(option.id)) {
            seenOptions.add(option.id);
            results.push(option);
          }
        } else {
          queue.push(nextState);
        }
      }
    }
  }

  const filtered = timeMode === 'arrive'
    ? results.filter((option) => option.arrivalSec <= arriveBySec)
    : results;
  return { options: filtered, timedOut: false };
}

function reformatOptionWithDate(option, dateKey) {
  return {
    ...option,
    departureTime: formatDateTimeLocal(dateKey, option.departureSec),
    arrivalTime: formatDateTimeLocal(dateKey, option.arrivalSec),
    legs: option.legs.map((leg) => ({
      ...leg,
      ...(leg.type === 'ride'
        ? {
            departureTime: formatDateTimeLocal(dateKey, leg.departureSec),
            arrivalTime: formatDateTimeLocal(dateKey, leg.arrivalSec),
          }
        : {
            startTime: formatDateTimeLocal(dateKey, leg.startSec),
            endTime: formatDateTimeLocal(dateKey, leg.endSec),
          }),
    })),
  };
}

function findJourneyOptions({
  index,
  originId,
  destinationId,
  date,
  time,
  timeMode = 'depart',
  maxOptions = MAX_OPTIONS_DEFAULT,
  lineContextById = {},
}) {
  if (!index.stationsById.has(originId)) {
    const err = new Error('Invalid originId');
    err.status = 400;
    throw err;
  }
  if (!index.stationsById.has(destinationId)) {
    const err = new Error('Invalid destinationId');
    err.status = 400;
    throw err;
  }
  if (originId === destinationId) {
    const err = new Error('originId and destinationId must be different');
    err.status = 400;
    throw err;
  }

  let dateKey;
  let querySec;
  try {
    dateKey = parseQueryDate(date);
    querySec = parseQueryTime(time);
  } catch (error) {
    error.status = 400;
    throw error;
  }
  const mode = timeMode === 'arrive' ? 'arrive' : 'depart';
  const limit = Math.max(1, Math.min(Number(maxOptions || MAX_OPTIONS_DEFAULT), 12));

  const activeServices = getActiveServicesForDate(index, dateKey);
  const searchStartSec = mode === 'arrive'
    ? Math.max(0, querySec - SEARCH_HORIZON_SECONDS)
    : querySec;
  const searchEndSec = mode === 'arrive'
    ? querySec
    : (querySec + SEARCH_HORIZON_SECONDS);
  const arriveBySec = mode === 'arrive' ? querySec : null;

  const startMs = Date.now();
  let partialSearch = false;
  const dedupe = new Map();

  for (let transferDepth = 0; transferDepth <= MAX_TRANSFERS; transferDepth += 1) {
    const { options, timedOut } = searchDepth({
      index,
      originId,
      destinationId,
      startSec: searchStartSec,
      endSec: searchEndSec,
      maxRides: transferDepth + 1,
      activeServices,
      startMs,
      deadlineMs: SEARCH_BUDGET_MS,
      timeMode: mode,
      arriveBySec,
    });

    for (const option of options) {
      dedupe.set(option.id, option);
    }

    if (timedOut) {
      partialSearch = true;
      break;
    }

    if ((Date.now() - startMs) > SEARCH_BUDGET_MS) {
      partialSearch = true;
      break;
    }
  }

  let options = Array.from(dedupe.values())
    .map((option) => reformatOptionWithDate(option, dateKey))
    .map((option) => calculateOptionScore(option, lineContextById))
    .sort((a, b) => {
      const byScore = a.score - b.score;
      if (byScore !== 0) return byScore;
      return a.departureSec - b.departureSec;
    });

  if (mode === 'arrive') {
    options = options
      .filter((option) => option.arrivalSec <= querySec)
      .sort((a, b) => {
        const byArrivalGap = (querySec - a.arrivalSec) - (querySec - b.arrivalSec);
        if (byArrivalGap !== 0) return byArrivalGap;
        return a.score - b.score;
      });
  }

  const emptyReason = options.length
    ? null
    : (activeServices.size ? 'no_connection' : 'no_service_window');

  return {
    query: {
      originId,
      destinationId,
      date: dateKey,
      time,
      timeMode: mode,
      timezone: TIMEZONE,
    },
    options: options.slice(0, limit),
    partialSearch,
    emptyReason,
  };
}

function searchStations(index, query, limit = 10) {
  const raw = String(query || '').trim();
  if (!raw) return [];

  const normalizedQuery = normalizeText(raw);
  const max = Math.max(1, Math.min(Number(limit || 10), 20));

  return Array.from(index.stationsById.values())
    .map((station) => {
      const haystack = station.searchName;
      let rank = Infinity;
      if (haystack === normalizedQuery) rank = 0;
      else if (haystack.startsWith(normalizedQuery)) rank = 1;
      else if (haystack.includes(normalizedQuery)) rank = 2;
      if (rank === Infinity) return null;
      return {
        id: station.id,
        name: station.name,
        lat: station.lat,
        lon: station.lon,
        modes: station.modes,
        rank,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.name.localeCompare(b.name);
    })
    .slice(0, max)
    .map(({ rank, ...station }) => station);
}

function buildPlannerIndex(gtfsData) {
  const {
    routes = [],
    trips = [],
    stopTimes = [],
    stops = [],
    calendar = [],
    calendarDates = [],
  } = gtfsData || {};

  const { stationsById, stopToStationId } = buildStations(stops);
  const routesById = buildRoutes(routes);
  const tripsById = buildTrips(trips, routesById);
  const tripStopsByTripId = buildTripStopTimes(stopTimes, stopToStationId);
  const departuresByStationId = buildDeparturesByStation(tripsById, tripStopsByTripId);
  const nearbyByStationId = buildNearbyTransfers(stationsById);
  const { calendarByServiceId, exceptionsByServiceId } = buildCalendar(calendar, calendarDates);

  return {
    stationsById,
    stopToStationId,
    routesById,
    tripsById,
    tripStopsByTripId,
    departuresByStationId,
    nearbyByStationId,
    calendarByServiceId,
    exceptionsByServiceId,
    activeServicesCache: new Map(),
    constants: {
      timezone: TIMEZONE,
      searchHorizonSeconds: SEARCH_HORIZON_SECONDS,
      transferRadiusMeters: TRANSFER_RADIUS_METERS,
      minInterchangeSeconds: MIN_INTERCHANGE_SECONDS,
      maxTransfers: MAX_TRANSFERS,
      searchBudgetMs: SEARCH_BUDGET_MS,
    },
  };
}

async function getPlannerIndex() {
  if (plannerIndex) return plannerIndex;

  if (!plannerIndexPromise) {
    plannerIndexPromise = loadGtfsStaticData()
      .then((gtfsData) => {
        plannerIndex = buildPlannerIndex(gtfsData);
        return plannerIndex;
      })
      .finally(() => {
        plannerIndexPromise = null;
      });
  }

  return plannerIndexPromise;
}

function resetPlannerIndexForTests() {
  plannerIndex = null;
  plannerIndexPromise = null;
}

module.exports = {
  buildPlannerIndex,
  getPlannerIndex,
  searchStations,
  findJourneyOptions,
  parseGtfsTime,
  resetPlannerIndexForTests,
};
