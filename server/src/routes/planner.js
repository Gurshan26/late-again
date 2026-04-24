const express = require('express');
const lines = require('../data/lines.json');
const { getPlannerIndex, searchStations, findJourneyOptions } = require('../services/planner');
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

function topAlert(alerts) {
  if (!alerts.length) return null;
  return [...alerts].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0];
}

async function buildLineContext(datetime) {
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

  const byLine = {};

  for (const line of lines) {
    const lineDelays = activeDelays.filter((delay) => ROUTE_ID_MAP[delay.routeId] === line.id);
    const totalDelay = lineDelays.reduce((sum, delay) => sum + delay.delaySeconds, 0);
    const lineAlerts = classifiedMetro
      .filter((alert) => alert.routes.some((routeId) => ROUTE_ID_MAP[routeId] === line.id));

    const hasAlert = lineAlerts.length > 0;
    const alertSeverity = maxSeverity(lineAlerts);
    const strongestAlert = topAlert(lineAlerts);

    const risk = predictDelayRiskDetailed({
      lineId: line.id,
      datetime,
      activeDelaySeconds: totalDelay,
      hasAlert,
      weatherRisk,
      alertSeverity,
    });

    byLine[line.id] = {
      lineId: line.id,
      riskScore: risk.score,
      riskLabel: risk.label,
      maxAlertSeverity: alertSeverity || 'info',
      maxAlertCategory: strongestAlert ? strongestAlert.category : null,
      activeDelayCount: lineDelays.length,
      totalDelaySeconds: totalDelay,
      hasAlert,
      weatherRisk,
    };
  }

  return {
    byLine,
    weatherRisk,
    weatherForecast,
  };
}

router.get('/stations', async (req, res, next) => {
  try {
    const query = String(req.query.query || '').trim();
    const limit = Number(req.query.limit || 10);
    const index = await getPlannerIndex();

    const stations = query
      ? searchStations(index, query, limit)
      : [];

    return res.json({
      stations,
      query,
      total: stations.length,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/options', async (req, res, next) => {
  try {
    const {
      originId,
      destinationId,
      date,
      time,
      timeMode = 'depart',
      maxOptions = 6,
    } = req.query;

    if (!originId || !destinationId || !date || !time) {
      return res.status(400).json({
        error: 'originId, destinationId, date, and time are required.',
      });
    }

    const datetime = new Date();
    const dataHealth = combineHealth(['ptv', 'weather']);
    const index = await getPlannerIndex();

    const lineContext = await buildLineContext(datetime);
    const plannerResult = findJourneyOptions({
      index,
      originId: String(originId),
      destinationId: String(destinationId),
      date: String(date),
      time: String(time),
      timeMode: String(timeMode),
      maxOptions: Number(maxOptions),
      lineContextById: lineContext.byLine,
    });

    const options = plannerResult.options.map((option) => {
      const primaryLine = option.primaryLineId && lineContext.byLine[option.primaryLineId]
        ? lineContext.byLine[option.primaryLineId]
        : null;

      const recommendation = buildRecommendation({
        lineId: option.primaryLineId || 'frankston',
        riskScore: option.riskScore,
        riskLabel: option.riskLabel,
        alertSeverity: option.maxAlertSeverity,
        alertCategory: primaryLine ? primaryLine.maxAlertCategory : null,
        activeDelaySeconds: primaryLine ? primaryLine.totalDelaySeconds : 0,
        weatherRisk: lineContext.weatherRisk || 0,
        datetime,
        dataHealth,
        tripProfile: null,
      });

      return {
        id: option.id,
        departureTime: option.departureTime,
        arrivalTime: option.arrivalTime,
        durationMinutes: option.durationMinutes,
        transferCount: option.transferCount,
        walkMinutes: option.walkMinutes,
        legs: option.legs,
        involvedLines: option.involvedLineIds,
        primaryLineId: option.primaryLineId,
        maxAlertSeverity: option.maxAlertSeverity,
        riskScore: option.riskScore,
        riskLabel: option.riskLabel,
        recommendation,
        score: option.score,
      };
    });

    return res.json({
      query: plannerResult.query,
      options,
      partialSearch: plannerResult.partialSearch,
      emptyReason: plannerResult.emptyReason,
      dataHealth,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error && error.status) {
      return res.status(error.status).json({
        error: error.message,
        emptyReason: 'invalid_input',
      });
    }
    return next(error);
  }
});

module.exports = router;
