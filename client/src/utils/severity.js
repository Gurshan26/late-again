export const SEVERITY_ORDER = ['info', 'minor', 'moderate', 'major', 'critical'];

export const ROUTE_ID_MAP = {
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

export function severityRank(severity) {
  return SEVERITY_ORDER.indexOf(severity || 'info');
}

export function sortAlertsBySeverity(alerts) {
  return [...alerts].sort((a, b) => {
    const bySeverity = severityRank(b.severity) - severityRank(a.severity);
    if (bySeverity !== 0) return bySeverity;
    return String(a.id).localeCompare(String(b.id));
  });
}

export function isAlertActiveNow(alert) {
  const activePeriod = alert.activePeriod || [];
  if (activePeriod.length === 0) return true;

  const now = Math.floor(Date.now() / 1000);
  return activePeriod.some((period) => {
    const start = period.start || null;
    const end = period.end || null;

    if (start && now < start) return false;
    if (end && now > end) return false;
    return true;
  });
}

export function severityTone(severity) {
  if (severity === 'critical') return 'critical';
  if (severity === 'major') return 'major';
  if (severity === 'moderate') return 'moderate';
  if (severity === 'minor') return 'minor';
  return 'info';
}
