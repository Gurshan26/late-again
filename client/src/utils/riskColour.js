export function riskColour(score, alpha = 1) {
  if (score === null || score === undefined) return `rgba(122, 130, 153, ${alpha})`;
  if (score < 30) return `rgba(0, 212, 170, ${alpha})`;
  if (score < 50) return `rgba(0, 210, 220, ${alpha})`;
  if (score < 65) return `rgba(255, 170, 0, ${alpha})`;
  if (score < 80) return `rgba(255, 110, 0, ${alpha})`;
  return `rgba(255, 60, 60, ${alpha})`;
}

export function riskLabel(score) {
  if (score === null || score === undefined) return 'UNKNOWN';
  if (score < 30) return 'LOW RISK';
  if (score < 50) return 'MINOR RISK';
  if (score < 65) return 'MODERATE';
  if (score < 80) return 'HIGH RISK';
  return 'SEVERE';
}
