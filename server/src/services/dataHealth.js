const feedState = {
  ptv: {
    lastSuccess: null,
    lastFailure: null,
    lastError: null,
    source: 'PTV GTFS Realtime',
    mode: 'unknown',
  },
  weather: {
    lastSuccess: null,
    lastFailure: null,
    lastError: null,
    source: 'Open-Meteo',
    mode: 'unknown',
  },
};

function nowIso() {
  return new Date().toISOString();
}

function secondsSince(isoString) {
  if (!isoString) return null;
  return Math.max(0, Math.round((Date.now() - new Date(isoString).getTime()) / 1000));
}

function markSuccess(feedName) {
  const feed = feedState[feedName];
  if (!feed) return;

  feed.lastSuccess = nowIso();
  feed.lastError = null;
  feed.mode = 'success';
}

function markFailure(feedName, error) {
  const feed = feedState[feedName];
  if (!feed) return;

  feed.lastFailure = nowIso();
  feed.lastError = error ? error.message || String(error) : 'Unknown error';
  feed.mode = 'failure';
}

function statusFromAge(ageSeconds) {
  if (ageSeconds === null) return 'unknown';
  if (ageSeconds <= 60) return 'live';
  if (ageSeconds <= 120) return 'recent';
  if (ageSeconds > 300) return 'stale';
  return 'recent';
}

function createMessage({ status, source, ageSeconds, lastError }) {
  if (status === 'demo') {
    return 'PTV_API_KEY is not set. Running in demo mode with baseline and weather predictions only.';
  }
  if (status === 'live') {
    return `Live ${source} data received less than 60 seconds ago.`;
  }
  if (status === 'recent') {
    return `${source} data is recent (${ageSeconds}s old).`;
  }
  if (status === 'stale') {
    return `${source} data is stale (${ageSeconds}s old).${lastError ? ` Last error: ${lastError}` : ''}`;
  }
  if (status === 'partial') {
    return `${source} is partially available.${lastError ? ` Last error: ${lastError}` : ''}`;
  }
  return `No ${source} fetch has completed yet.`;
}

function getFeedHealth(feedName) {
  const feed = feedState[feedName];
  if (!feed) {
    return {
      status: 'unknown',
      source: feedName,
      message: 'Unknown feed.',
      lastUpdated: null,
      ageSeconds: null,
    };
  }

  if (feedName === 'ptv' && !process.env.PTV_API_KEY) {
    return {
      status: 'demo',
      source: feed.source,
      message: createMessage({ status: 'demo', source: feed.source }),
      lastUpdated: null,
      ageSeconds: null,
      lastError: null,
    };
  }

  const ageSeconds = secondsSince(feed.lastSuccess);

  if (!feed.lastSuccess && !feed.lastFailure) {
    return {
      status: 'unknown',
      source: feed.source,
      message: createMessage({ status: 'unknown', source: feed.source }),
      lastUpdated: null,
      ageSeconds: null,
      lastError: null,
    };
  }

  if (feed.lastFailure && (!feed.lastSuccess || new Date(feed.lastFailure) > new Date(feed.lastSuccess))) {
    if (feed.lastSuccess) {
      return {
        status: 'partial',
        source: feed.source,
        message: createMessage({ status: 'partial', source: feed.source, lastError: feed.lastError }),
        lastUpdated: feed.lastSuccess,
        ageSeconds,
        lastError: feed.lastError,
      };
    }

    return {
      status: 'stale',
      source: feed.source,
      message: createMessage({ status: 'stale', source: feed.source, ageSeconds: null, lastError: feed.lastError }),
      lastUpdated: null,
      ageSeconds: null,
      lastError: feed.lastError,
    };
  }

  const status = statusFromAge(ageSeconds);
  return {
    status,
    source: feed.source,
    message: createMessage({ status, source: feed.source, ageSeconds, lastError: feed.lastError }),
    lastUpdated: feed.lastSuccess,
    ageSeconds,
    lastError: feed.lastError,
  };
}

function combineHealth(feedNames) {
  const feeds = {};
  const selected = feedNames.map((feedName) => {
    const health = getFeedHealth(feedName);
    feeds[feedName] = health;
    return health;
  });

  if (selected.some((health) => health.status === 'demo')) {
    const demo = selected.find((health) => health.status === 'demo');
    return {
      status: 'demo',
      source: selected.map((health) => health.source).join(' + '),
      message: demo.message,
      lastUpdated: null,
      ageSeconds: null,
      feeds,
    };
  }

  const statuses = selected.map((health) => health.status);
  const successful = selected.filter((health) => health.lastUpdated);
  const newestTs = successful.length
    ? successful.reduce((latest, feed) => (new Date(feed.lastUpdated) > new Date(latest) ? feed.lastUpdated : latest), successful[0].lastUpdated)
    : null;
  const ageSeconds = newestTs ? secondsSince(newestTs) : null;

  let status = 'unknown';

  if (statuses.every((s) => s === 'live')) status = 'live';
  else if (statuses.includes('partial')) status = 'partial';
  else if (statuses.includes('stale') && statuses.some((s) => s === 'live' || s === 'recent')) status = 'partial';
  else if (statuses.every((s) => s === 'stale')) status = 'stale';
  else if (statuses.includes('recent')) status = 'recent';
  else if (statuses.includes('live')) status = 'live';
  else if (statuses.every((s) => s === 'unknown')) status = 'unknown';

  const source = selected.map((health) => health.source).join(' + ');
  const message = status === 'partial'
    ? 'One or more data feeds are currently degraded. Showing best available information.'
    : createMessage({ status, source, ageSeconds });

  return {
    status,
    source,
    message,
    lastUpdated: newestTs,
    ageSeconds,
    feeds,
  };
}

module.exports = {
  feedState,
  markSuccess,
  markFailure,
  getFeedHealth,
  combineHealth,
};
