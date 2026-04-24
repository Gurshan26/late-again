function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function buildAlternatives(lineId, alertCategory) {
  const lineName = lineId.replace(/-/g, ' ');
  const alternatives = [
    `Check nearby lines or tram connections if ${lineName} disruptions continue.`,
    'Use PTV Journey Planner for real-time multimodal alternatives.',
  ];

  if (alertCategory === 'replacement_bus') {
    alternatives.unshift('Review replacement bus stops and transfer times before departing.');
  }

  return alternatives;
}

function baseDecision({ riskScore, alertCategory, dataHealth }) {
  if (dataHealth && dataHealth.status === 'demo') {
    return {
      action: 'unknown_live_data',
      title: 'Live PTV data is not connected',
      reason: 'Prediction is based on baseline risk and weather only.',
      extraMinutes: 0,
    };
  }

  if (alertCategory === 'replacement_bus') {
    return {
      action: 'reroute',
      title: 'Check replacement bus options',
      reason: 'This disruption may involve train replacement buses.',
      extraMinutes: 15,
    };
  }

  if (riskScore >= 80) {
    return {
      action: 'avoid',
      title: 'Avoid this route if possible',
      reason: 'Severe disruption risk is currently detected on this line.',
      extraMinutes: 25,
    };
  }

  if (riskScore >= 65) {
    return {
      action: 'leave_early',
      title: 'Leave 20 minutes earlier',
      reason: 'High live delay risk is currently detected for this line.',
      extraMinutes: 20,
    };
  }

  if (riskScore >= 50) {
    return {
      action: 'leave_early',
      title: 'Leave 10 minutes earlier',
      reason: 'Moderate disruption risk is likely to impact travel time.',
      extraMinutes: 10,
    };
  }

  if (riskScore >= 35) {
    return {
      action: 'monitor',
      title: 'Monitor conditions before leaving',
      reason: 'Risk is elevated but not yet severe.',
      extraMinutes: 0,
    };
  }

  return {
    action: 'go_now',
    title: 'Conditions look stable',
    reason: 'Current risk is low for this line and time window.',
    extraMinutes: 0,
  };
}

function buildRecommendation({
  lineId,
  riskScore,
  riskLabel,
  alertSeverity,
  alertCategory,
  activeDelaySeconds,
  weatherRisk,
  datetime,
  dataHealth,
  tripProfile,
}) {
  const decision = baseDecision({
    riskScore,
    alertCategory,
    dataHealth: dataHealth || { status: 'unknown' },
  });

  let extraMinutes = decision.extraMinutes;
  if (tripProfile && Number.isFinite(Number(tripProfile.bufferMinutes))) {
    extraMinutes = Math.max(extraMinutes, Number(tripProfile.bufferMinutes));
  }

  let confidence = 0.55;
  if (dataHealth && dataHealth.status === 'live') confidence += 0.2;
  if ((activeDelaySeconds || 0) > 0) confidence += 0.1;
  if (alertSeverity && alertSeverity !== 'info') confidence += 0.1;
  if (dataHealth && (dataHealth.status === 'stale' || dataHealth.status === 'partial')) confidence -= 0.2;
  confidence = clamp(confidence, 0.25, 0.95);

  const title = decision.action === 'leave_early'
    ? `Leave ${extraMinutes} minutes earlier`
    : decision.title;

  const reasonTail = weatherRisk >= 0.6
    ? ' Severe weather is also increasing risk.'
    : '';

  return {
    action: decision.action,
    title,
    reason: `${decision.reason}${reasonTail}`,
    confidence: Number(confidence.toFixed(2)),
    extraMinutes,
    alternatives: buildAlternatives(lineId, alertCategory),
    context: {
      riskLabel,
      at: datetime ? new Date(datetime).toISOString() : new Date().toISOString(),
    },
  };
}

module.exports = {
  buildRecommendation,
};
