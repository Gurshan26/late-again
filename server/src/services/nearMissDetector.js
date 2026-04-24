function withinMinutes(isoTimestamp, minutes) {
  if (!isoTimestamp) return false;
  return Date.now() - new Date(isoTimestamp).getTime() <= minutes * 60 * 1000;
}

function detectNearMiss({
  currentSnapshot,
  previousSnapshots,
  lineGroupAlerts,
  weatherRisk,
}) {
  const reasons = [];
  const snapshots = (previousSnapshots || []).filter((item) => withinMinutes(item.timestamp, 15));

  if (snapshots.length > 0) {
    const earliest = snapshots[0];
    const riskDelta = (currentSnapshot.risk || 0) - (earliest.risk || 0);
    if (riskDelta >= 20) {
      reasons.push(`Risk increased by ${riskDelta} points in the last 15 minutes.`);
    }

    const delayDelta = (currentSnapshot.activeDelayCount || 0) - (earliest.activeDelayCount || 0);
    if (delayDelta >= 3) {
      reasons.push(`Active delay count increased by ${delayDelta} within 15 minutes.`);
    }
  }

  if ((weatherRisk || 0) >= 0.7 && (currentSnapshot.risk || 0) >= 45) {
    reasons.push('Severe weather risk is high while line risk is already elevated.');
  }

  if ((lineGroupAlerts || 0) >= 2) {
    reasons.push('Multiple lines in the same group have major or critical alerts.');
  }

  if (reasons.length === 0) {
    return {
      isNearMiss: false,
      reasons: [],
    };
  }

  const prettyLine = (currentSnapshot.lineId || 'selected line').replace(/-/g, ' ');
  return {
    isNearMiss: true,
    title: 'Early warning',
    message: `${prettyLine.charAt(0).toUpperCase() + prettyLine.slice(1)} line risk is rising quickly. Monitor before leaving.`,
    reasons,
  };
}

module.exports = {
  detectNearMiss,
};
