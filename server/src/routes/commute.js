const express = require('express');
const { getWeatherForecast, weatherRiskFactor, toMelbourneHourString } = require('../services/weather');
const { getActiveDelays, getMetroAlerts } = require('../services/gtfsRealtime');
const { classifyAlert } = require('../services/alertClassifier');
const { predictDelayRiskDetailed } = require('../services/predictor');
const { buildRecommendation } = require('../services/recommendationEngine');
const { combineHealth } = require('../services/dataHealth');

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

function severityRank(severity) {
  return SEVERITY_ORDER.indexOf(severity || 'info');
}

function maxSeverity(alerts) {
  if (!alerts.length) return null;
  return alerts
    .map((alert) => alert.severity)
    .sort((a, b) => severityRank(b) - severityRank(a))[0];
}

function statusFromRecommendation(recommendation) {
  if (!recommendation) return 'unknown';
  if (recommendation.action === 'avoid') return 'avoid';
  if (recommendation.action === 'leave_early' || recommendation.action === 'reroute') return 'risky';
  if (recommendation.action === 'monitor' || recommendation.action === 'wait') return 'watch';
  if (recommendation.action === 'go_now') return 'clear';
  return 'unknown';
}

function headlineFor({ status, lineId, recommendation }) {
  const name = lineId.replace(/-/g, ' ');
  const pretty = name.charAt(0).toUpperCase() + name.slice(1);

  if (status === 'clear') {
    return `Your ${pretty} commute looks okay right now.`;
  }

  if (status === 'watch') {
    return `Your ${pretty} commute is worth monitoring. Conditions may change soon.`;
  }

  if (status === 'risky') {
    if (recommendation.action === 'leave_early') {
      return `Your ${pretty} commute is currently risky. Leave ${recommendation.extraMinutes} minutes earlier.`;
    }
    return `Your ${pretty} commute is currently risky. Consider rerouting.`;
  }

  if (status === 'avoid') {
    return `Avoid your usual ${pretty} route if possible. Major disruption detected.`;
  }

  return 'Commute status is uncertain. Monitor live updates before leaving.';
}

router.get('/impact', async (req, res, next) => {
  try {
    const lineId = req.query.lineId || 'frankston';
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

    const lineAlerts = classifiedMetro
      .filter((alert) => alert.routes.some((routeId) => ROUTE_ID_MAP[routeId] === lineId))
      .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

    const alertSeverity = maxSeverity(lineAlerts);
    const alertCategory = lineAlerts[0] ? lineAlerts[0].category : null;

    const risk = predictDelayRiskDetailed({
      lineId,
      datetime,
      activeDelaySeconds: totalDelay,
      hasAlert: lineAlerts.length > 0,
      weatherRisk,
      alertSeverity,
    });

    const dataHealth = combineHealth(['ptv', 'weather']);
    const tripProfile = {
      id: 'commute-impact',
      name: 'Commute impact profile',
      origin: req.query.origin || null,
      destination: req.query.destination || null,
      lineId,
      bufferMinutes: req.query.bufferMinutes ? Number(req.query.bufferMinutes) : null,
      preferredArrival: req.query.preferredArrival || null,
      usualDeparture: req.query.departureTime || null,
    };

    const recommendation = buildRecommendation({
      lineId,
      riskScore: risk.score,
      riskLabel: risk.label,
      alertSeverity,
      alertCategory,
      activeDelaySeconds: totalDelay,
      weatherRisk,
      datetime,
      dataHealth,
      tripProfile,
    });

    const status = statusFromRecommendation(recommendation);

    return res.json({
      headline: headlineFor({ status, lineId, recommendation }),
      status,
      lineId,
      recommendation,
      risk,
      affectingAlerts: lineAlerts.slice(0, 5),
      dataHealth,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
