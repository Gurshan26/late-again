const express = require('express');
const lines = require('../data/lines.json');
const { getWeatherForecast, weatherRiskFactor, toMelbourneHourString } = require('../services/weather');
const { getActiveDelays, getMetroAlerts } = require('../services/gtfsRealtime');
const { classifyAlert } = require('../services/alertClassifier');
const { buildRecommendation } = require('../services/recommendationEngine');
const { detectNearMiss } = require('../services/nearMissDetector');
const { combineHealth } = require('../services/dataHealth');
const {
  predictDelayRisk,
  predictDelayRiskDetailed,
  predict24hProfile,
} = require('../services/predictor');

const router = express.Router();

const ROUTE_ID_MAP = {
  '1': 'alamein',
  '2': 'belgrave',
  '3': 'craigieburn',
  '4': 'cranbourne',
  '5': 'frankston',
  '6': 'glen-waverley',
  '7': 'hurstbridge',
  '8': 'lilydale',
  '9': 'mernda',
  '10': 'pakenham',
  '11': 'sandringham',
  '12': 'stony-point',
  '13': 'sunbury',
  '14': 'upfield',
  '15': 'werribee',
  '16': 'williamstown',
};

const SEVERITY_ORDER = ['info', 'minor', 'moderate', 'major', 'critical'];
const snapshotStore = new Map();

function severityRank(severity) {
  return SEVERITY_ORDER.indexOf(severity || 'info');
}

function maxSeverity(alerts) {
  if (!alerts.length) return null;
  return alerts
    .map((alert) => alert.severity)
    .sort((a, b) => severityRank(b) - severityRank(a))[0];
}

function toTripProfile(query, lineId) {
  const hasInput = query.origin || query.destination || query.departureTime || query.bufferMinutes;
  if (!hasInput) return null;

  return {
    id: 'query-profile',
    name: 'Ad hoc commute',
    origin: query.origin || null,
    destination: query.destination || null,
    lineId,
    usualDeparture: query.departureTime || null,
    bufferMinutes: query.bufferMinutes ? Number(query.bufferMinutes) : null,
  };
}

function getLineGroup(lineId) {
  const line = lines.find((entry) => entry.id === lineId);
  return line ? line.group : null;
}

function getPreviousSnapshots(lineId) {
  return snapshotStore.get(lineId) || [];
}

function addSnapshot(lineId, snapshot) {
  const previous = snapshotStore.get(lineId) || [];
  const next = [...previous, snapshot].slice(-50);
  snapshotStore.set(lineId, next);
}

router.get('/:lineId', async (req, res, next) => {
  try {
    const { lineId } = req.params;
    const datetime = req.query.datetime ? new Date(req.query.datetime) : new Date();

    if (Number.isNaN(datetime.getTime())) {
      return res.status(400).json({ error: 'Invalid datetime query parameter' });
    }

    const [weatherForecast, activeDelays, metroAlerts] = await Promise.all([
      getWeatherForecast(),
      getActiveDelays(),
      getMetroAlerts(),
    ]);

    const classifiedMetro = metroAlerts.map((alert) => classifyAlert({ ...alert, mode: 'metro' }));

    const isoHour = toMelbourneHourString(datetime);
    const weatherRisk = weatherForecast && weatherForecast.hourly
      ? weatherRiskFactor(weatherForecast.hourly, isoHour)
      : 0;

    const lineDelays = activeDelays.filter((delay) => ROUTE_ID_MAP[delay.routeId] === lineId);
    const totalDelay = lineDelays.reduce((sum, delay) => sum + delay.delaySeconds, 0);

    const lineAlerts = classifiedMetro.filter((alert) => alert.routes.some((routeId) => ROUTE_ID_MAP[routeId] === lineId));
    const hasAlert = lineAlerts.length > 0;
    const maxAlertSeverity = maxSeverity(lineAlerts);
    const maxAlertCategory = lineAlerts[0] ? lineAlerts.sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0].category : null;

    const detailed = predictDelayRiskDetailed({
      lineId,
      datetime,
      activeDelaySeconds: totalDelay,
      hasAlert,
      weatherRisk,
      alertSeverity: maxAlertSeverity,
    });

    const profile24h = predict24hProfile(lineId, datetime, weatherForecast, hasAlert, maxAlertSeverity);

    const tomorrow = new Date(datetime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);

    const tomorrowWRisk = weatherForecast && weatherForecast.hourly
      ? weatherRiskFactor(weatherForecast.hourly, toMelbourneHourString(tomorrow))
      : 0;

    const tomorrowMorningRisk = predictDelayRisk({
      lineId,
      datetime: tomorrow,
      activeDelaySeconds: 0,
      hasAlert: false,
      weatherRisk: tomorrowWRisk,
    });

    const dataHealth = combineHealth(['ptv', 'weather']);
    const tripProfile = toTripProfile(req.query, lineId);

    const recommendation = buildRecommendation({
      lineId,
      riskScore: detailed.score,
      riskLabel: detailed.label,
      alertSeverity: maxAlertSeverity,
      alertCategory: maxAlertCategory,
      activeDelaySeconds: totalDelay,
      weatherRisk,
      datetime,
      dataHealth,
      tripProfile,
    });

    const lineGroup = getLineGroup(lineId);
    const groupLineIds = lines.filter((line) => line.group === lineGroup).map((line) => line.id);
    const groupMajorAlerts = classifiedMetro.filter((alert) => {
      const touchesGroup = alert.routes.some((routeId) => groupLineIds.includes(ROUTE_ID_MAP[routeId]));
      return touchesGroup && (alert.severity === 'major' || alert.severity === 'critical');
    }).length;

    const currentSnapshot = {
      timestamp: new Date().toISOString(),
      lineId,
      risk: detailed.score,
      alertCount: lineAlerts.length,
      maxSeverity: maxAlertSeverity,
      totalDelaySeconds: totalDelay,
      activeDelayCount: lineDelays.length,
    };

    const nearMiss = detectNearMiss({
      currentSnapshot,
      previousSnapshots: getPreviousSnapshots(lineId),
      lineGroupAlerts: groupMajorAlerts,
      weatherRisk,
    });

    addSnapshot(lineId, currentSnapshot);

    return res.json({
      lineId,
      datetime: datetime.toISOString(),
      currentRisk: detailed.score,
      riskLabel: detailed.label,
      tomorrowMorningRisk,
      profile24h,
      weatherRisk: Math.round(weatherRisk * 100),
      hasAlert,
      maxAlertSeverity,
      activeDelayCount: lineDelays.length,
      totalActiveDelaySecs: totalDelay,
      explanation: detailed.explanation,
      recommendation,
      dataHealth,
      nearMiss,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
