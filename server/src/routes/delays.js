const express = require('express');
const lines = require('../data/lines.json');
const { getActiveDelays } = require('../services/gtfsRealtime');
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

router.get('/', async (req, res, next) => {
  try {
    const delays = await getActiveDelays();
    const byLine = {};

    for (const line of lines) {
      byLine[line.id] = {
        totalDelaySeconds: 0,
        count: 0,
        delays: [],
      };
    }

    for (const delay of delays) {
      const lineId = ROUTE_ID_MAP[delay.routeId] || null;
      if (!lineId || !byLine[lineId]) continue;

      byLine[lineId].totalDelaySeconds += delay.delaySeconds;
      byLine[lineId].count += 1;
      byLine[lineId].delays.push(delay);
    }

    res.json({
      byLine,
      dataHealth: combineHealth(['ptv']),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
