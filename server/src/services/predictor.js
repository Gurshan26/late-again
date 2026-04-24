const { weatherRiskFactor, toMelbourneHourString } = require('./weather');
const { buildRiskExplanation, scoreLabel } = require('./riskExplanation');

const HISTORICAL_BASELINE = {
  alamein: { peak: 15, offpeak: 8, weekend: 6 },
  belgrave: { peak: 22, offpeak: 12, weekend: 9 },
  'glen-waverley': { peak: 18, offpeak: 9, weekend: 7 },
  lilydale: { peak: 21, offpeak: 11, weekend: 8 },
  cranbourne: { peak: 25, offpeak: 13, weekend: 10 },
  pakenham: { peak: 27, offpeak: 14, weekend: 11 },
  sunbury: { peak: 20, offpeak: 10, weekend: 8 },
  hurstbridge: { peak: 30, offpeak: 18, weekend: 14 },
  mernda: { peak: 28, offpeak: 16, weekend: 12 },
  sandringham: { peak: 14, offpeak: 7, weekend: 5 },
  werribee: { peak: 19, offpeak: 10, weekend: 8 },
  williamstown: { peak: 17, offpeak: 9, weekend: 7 },
  craigieburn: { peak: 24, offpeak: 13, weekend: 10 },
  upfield: { peak: 20, offpeak: 11, weekend: 8 },
  frankston: { peak: 23, offpeak: 12, weekend: 9 },
  'stony-point': { peak: 35, offpeak: 20, weekend: 18 },
};

const ALERT_POINTS = {
  critical: 30,
  major: 22,
  moderate: 15,
  minor: 5,
  info: 0,
};

function melbourneHour(date) {
  return Number(
    new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Melbourne',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(date),
  );
}

function melbourneDay(date) {
  const key = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne',
    weekday: 'short',
  }).format(date);

  const map = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return map[key];
}

function getTimePeriod(hour, dayOfWeek) {
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  if (isWeekend) return 'weekend';

  const isPeak = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18);
  return isPeak ? 'peak' : 'offpeak';
}

function calculateComponents({
  lineId,
  datetime,
  activeDelaySeconds,
  hasAlert,
  weatherRisk,
  alertSeverity,
}) {
  const hour = melbourneHour(datetime);
  const dow = melbourneDay(datetime);
  const period = getTimePeriod(hour, dow);

  const baseline = HISTORICAL_BASELINE[lineId] || { peak: 20, offpeak: 12, weekend: 9 };
  const baselinePoints = baseline[period];

  const delayMinutes = (activeDelaySeconds || 0) / 60;
  const liveDelayPoints = activeDelaySeconds > 0 ? Math.min((delayMinutes / 5) * 3, 25) : 0;
  const weatherPoints = (weatherRisk || 0) * 20;

  let alertPoints = 0;
  let normalizedSeverity = alertSeverity || null;
  if (hasAlert) {
    normalizedSeverity = normalizedSeverity || 'moderate';
    alertPoints = ALERT_POINTS[normalizedSeverity] ?? ALERT_POINTS.moderate;
  }

  const score = Math.min(
    Math.round(baselinePoints + liveDelayPoints + weatherPoints + alertPoints),
    100,
  );

  return {
    score,
    label: scoreLabel(score),
    baselinePoints,
    liveDelayPoints,
    weatherPoints,
    alertPoints,
    alertSeverity: normalizedSeverity,
  };
}

function predictDelayRisk(params) {
  return calculateComponents(params).score;
}

function predictDelayRiskDetailed(params) {
  const components = calculateComponents(params);
  const explanation = buildRiskExplanation({
    lineId: params.lineId,
    datetime: params.datetime,
    baselinePoints: components.baselinePoints,
    liveDelayPoints: components.liveDelayPoints,
    weatherPoints: components.weatherPoints,
    alertPoints: components.alertPoints,
    alertSeverity: components.alertSeverity,
    activeDelaySeconds: params.activeDelaySeconds,
    weatherRisk: params.weatherRisk,
    hasAlert: params.hasAlert,
  });

  return {
    score: components.score,
    label: components.label,
    baselinePoints: Math.round(components.baselinePoints),
    liveDelayPoints: Math.round(components.liveDelayPoints),
    weatherPoints: Math.round(components.weatherPoints),
    alertPoints: Math.round(components.alertPoints),
    explanation,
  };
}

function predict24hProfile(lineId, date, weatherForecast, hasAlert, alertSeverity) {
  const hourlyData = weatherForecast && weatherForecast.hourly;
  const hours = [];

  for (let h = 0; h < 24; h += 1) {
    const dt = new Date(date);
    dt.setHours(h, 0, 0, 0);

    const isoHour = toMelbourneHourString(dt);
    const wRisk = hourlyData ? weatherRiskFactor(hourlyData, isoHour) : 0;

    hours.push({
      hour: h,
      risk: predictDelayRisk({
        lineId,
        datetime: dt,
        activeDelaySeconds: 0,
        hasAlert,
        weatherRisk: wRisk,
        alertSeverity,
      }),
    });
  }

  return hours;
}

module.exports = {
  predictDelayRisk,
  predictDelayRiskDetailed,
  predict24hProfile,
  getTimePeriod,
};
