const SEVERITY_SCORE = {
  critical: 100,
  major: 80,
  moderate: 55,
  minor: 25,
  info: 10,
};

function getTranslation(field) {
  if (!field || !field.translation || !field.translation[0]) return '';
  return field.translation[0].text || '';
}

function extractAlertText(rawAlert) {
  const alert = rawAlert.alert || rawAlert;
  const header = getTranslation(alert.headerText) || rawAlert.header || '';
  const description = getTranslation(alert.descriptionText) || rawAlert.description || '';
  return `${header} ${description}`.trim();
}

function textIncludes(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function classifySeverity(text, effect) {
  const normalized = text.toLowerCase();

  if (textIncludes(normalized, [
    'no trains',
    'suspended',
    'major delays',
    'emergency services',
    'police request',
    'person hit by train',
    'evacuation',
    'network wide',
  ])) {
    return 'critical';
  }

  if (textIncludes(normalized, [
    'buses replace trains',
    'replacement buses',
    'significant delays',
    'delays up to 30',
    'cancelled',
    'canceled',
    'city loop',
  ])) {
    return 'major';
  }

  if (textIncludes(normalized, [
    'delays',
    'allow extra travel time',
    'service changes',
    'planned works',
    'modified timetable',
  ])) {
    return 'moderate';
  }

  if (textIncludes(normalized, [
    'car park',
    'lift',
    'escalator',
    'toilet',
    'station access',
    'parking',
    'ticket office',
  ])) {
    return 'minor';
  }

  if (textIncludes(normalized, ['information', 'reminder', 'maintenance', 'advice'])) {
    return 'info';
  }

  if (effect === 1 || effect === 'NO_SERVICE') return 'critical';
  if (effect === 3 || effect === 'SIGNIFICANT_DELAYS') return 'major';
  if (effect === 2 || effect === 'REDUCED_SERVICE') return 'moderate';

  return 'info';
}

function classifyCategory(text) {
  const normalized = text.toLowerCase();

  if (textIncludes(normalized, ['replacement bus', 'buses replace trains'])) return 'replacement_bus';
  if (textIncludes(normalized, ['cancelled', 'canceled', 'cancelation', 'cancellation'])) return 'cancellation';
  if (textIncludes(normalized, ['delay', 'allow extra travel time', 'significant delays'])) return 'delay';
  if (textIncludes(normalized, ['car park', 'lift', 'escalator', 'toilet', 'station access', 'parking', 'ticket office'])) return 'station_facility';
  if (textIncludes(normalized, ['planned works', 'works', 'maintenance'])) return 'planned_works';
  if (textIncludes(normalized, ['city loop'])) return 'city_loop';
  if (textIncludes(normalized, ['weather', 'storm', 'wind', 'rain'])) return 'weather';
  if (textIncludes(normalized, ['police', 'emergency', 'safety', 'evacuation'])) return 'safety';

  return 'unknown';
}

function isFacilityOnly(text) {
  return textIncludes(text.toLowerCase(), [
    'car park',
    'lift',
    'escalator',
    'toilet',
    'station access',
    'parking',
    'ticket office',
  ]);
}

function isPlanned(text) {
  return textIncludes(text.toLowerCase(), [
    'planned',
    'planned works',
    'scheduled',
    'maintenance',
    'works',
  ]);
}

function getAffectedRoutes(rawAlert) {
  const informed = (rawAlert.alert && rawAlert.alert.informedEntity) || rawAlert.informedEntity || [];
  const routes = informed.map((entity) => entity.routeId).filter(Boolean);
  return [...new Set(routes)];
}

function getAffectedStops(rawAlert) {
  const informed = (rawAlert.alert && rawAlert.alert.informedEntity) || rawAlert.informedEntity || [];
  const stops = informed.map((entity) => entity.stopId).filter(Boolean);
  return [...new Set(stops)];
}

function createPlainEnglishSummary(rawAlert) {
  const text = extractAlertText(rawAlert);
  if (!text) return 'General service information is currently active.';

  const normalized = text.toLowerCase();
  if (normalized.includes('replacement bus')) return 'Trains may be replaced by buses for part of this route.';
  if (normalized.includes('major delays')) return 'Major delays are expected. Allow substantial extra travel time.';
  if (normalized.includes('delay')) return 'Delays are expected. Allow extra travel time.';
  if (normalized.includes('planned works')) return 'Planned works are impacting normal services.';
  if (isFacilityOnly(normalized)) return 'A station facility issue has been reported.';

  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function classifyAlert(rawAlert) {
  const text = extractAlertText(rawAlert);
  const severity = classifySeverity(text, rawAlert.alert ? rawAlert.alert.effect : rawAlert.effect);
  const category = classifyCategory(text);
  const planned = isPlanned(text);
  const facilityOnly = isFacilityOnly(text);

  return {
    id: rawAlert.id,
    severity,
    severityScore: SEVERITY_SCORE[severity],
    category,
    planned,
    facilityOnly,
    mode: rawAlert.mode || rawAlert.type || 'unknown',
    header: getTranslation(rawAlert.alert && rawAlert.alert.headerText) || rawAlert.header || '',
    description: getTranslation(rawAlert.alert && rawAlert.alert.descriptionText) || rawAlert.description || '',
    plainEnglish: createPlainEnglishSummary(rawAlert),
    routes: getAffectedRoutes(rawAlert),
    stops: getAffectedStops(rawAlert),
    activePeriod: (rawAlert.alert && rawAlert.alert.activePeriod) || rawAlert.activePeriod || [],
    rawEffect: rawAlert.alert ? rawAlert.alert.effect : rawAlert.effect || null,
  };
}

module.exports = {
  classifyAlert,
  extractAlertText,
  classifySeverity,
  classifyCategory,
  isFacilityOnly,
  isPlanned,
  getAffectedRoutes,
  getAffectedStops,
  createPlainEnglishSummary,
};
