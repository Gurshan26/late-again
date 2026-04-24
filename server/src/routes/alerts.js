const express = require('express');
const { getMetroAlerts, getTramAlerts } = require('../services/gtfsRealtime');
const { classifyAlert } = require('../services/alertClassifier');
const { combineHealth } = require('../services/dataHealth');

const router = express.Router();

function isActiveNow(alert) {
  if (!alert.activePeriod || alert.activePeriod.length === 0) return true;
  const nowSec = Math.floor(Date.now() / 1000);

  return alert.activePeriod.some((period) => {
    const start = period.start || null;
    const end = period.end || null;
    if (start && nowSec < start) return false;
    if (end && nowSec > end) return false;
    return true;
  });
}

function rankAlerts(a, b) {
  if (b.severityScore !== a.severityScore) return b.severityScore - a.severityScore;

  const activeA = isActiveNow(a) ? 1 : 0;
  const activeB = isActiveNow(b) ? 1 : 0;
  if (activeB !== activeA) return activeB - activeA;

  return String(a.id).localeCompare(String(b.id));
}

function summarize(alerts) {
  const summary = {
    critical: 0,
    major: 0,
    moderate: 0,
    minor: 0,
    info: 0,
  };

  for (const alert of alerts) {
    summary[alert.severity] += 1;
  }

  return summary;
}

router.get('/', async (req, res, next) => {
  try {
    const [metroRaw, tramRaw] = await Promise.all([
      getMetroAlerts(),
      getTramAlerts(),
    ]);

    const metro = metroRaw.map((alert) => classifyAlert({ ...alert, mode: 'metro' }));
    const trams = tramRaw.map((alert) => classifyAlert({ ...alert, mode: 'tram' }));
    const alerts = [...metro, ...trams].sort(rankAlerts);

    res.json({
      alerts,
      metro: metro.sort(rankAlerts),
      trams: trams.sort(rankAlerts),
      summary: summarize(alerts),
      dataHealth: combineHealth(['ptv']),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
