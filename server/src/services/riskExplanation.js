function scoreLabel(score) {
  if (score < 30) return 'LOW RISK';
  if (score < 50) return 'MINOR RISK';
  if (score < 65) return 'MODERATE';
  if (score < 80) return 'HIGH RISK';
  return 'SEVERE';
}

function buildRiskExplanation({
  lineId,
  datetime,
  baselinePoints,
  liveDelayPoints,
  weatherPoints,
  alertPoints,
  alertSeverity,
  activeDelaySeconds,
  weatherRisk,
  hasAlert,
}) {
  const total = Math.min(
    Math.round((baselinePoints || 0) + (liveDelayPoints || 0) + (weatherPoints || 0) + (alertPoints || 0)),
    100,
  );

  const delayMins = Math.round((activeDelaySeconds || 0) / 60);
  const hour = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(datetime);

  const weatherPercent = Math.round((weatherRisk || 0) * 100);

  return {
    total,
    label: scoreLabel(total),
    breakdown: [
      {
        factor: 'Peak hour baseline',
        points: Math.round(baselinePoints || 0),
        explanation: `${lineId} baseline risk at ${hour}:00 in Melbourne contributes the core risk score.`,
      },
      {
        factor: 'Live delays',
        points: Math.round(liveDelayPoints || 0),
        explanation: delayMins > 0
          ? `Current PTV trip updates show around ${delayMins} minutes of active delay on this line.`
          : 'No significant active delays were detected in current trip updates.',
      },
      {
        factor: 'Weather',
        points: Math.round(weatherPoints || 0),
        explanation: weatherPercent > 0
          ? `Weather conditions are adding risk (about ${weatherPercent}% weather risk factor).`
          : 'Current weather conditions are not materially increasing delay risk.',
      },
      {
        factor: 'Alert severity',
        points: Math.round(alertPoints || 0),
        explanation: hasAlert
          ? `An active ${alertSeverity || 'moderate'} alert is increasing the disruption risk.`
          : 'No active line-level alert penalty is applied.',
      },
    ],
  };
}

module.exports = {
  buildRiskExplanation,
  scoreLabel,
};
