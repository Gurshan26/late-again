import { useEffect, useState } from 'react';

const STORAGE_KEY = 'late-again-change-timeline-v1';

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

function writeStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

const majorish = new Set(['major', 'critical']);

function getTimeLabel(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Australia/Melbourne',
  });
}

function deriveChanges(previous, current) {
  if (!previous || !current) return [];
  const changes = [];

  const riskDelta = (current.risk || 0) - (previous.risk || 0);
  if (riskDelta >= 5) {
    changes.push(`Risk rose from ${previous.risk} to ${current.risk}`);
  } else if (riskDelta <= -5) {
    changes.push(`Risk dropped from ${previous.risk} to ${current.risk}`);
  }

  const prevDelay = previous.activeDelayCount || 0;
  const currDelay = current.activeDelayCount || 0;
  if (currDelay - prevDelay >= 1) {
    changes.push(`Delay count increased from ${prevDelay} to ${currDelay}`);
  } else if (prevDelay - currDelay >= 1) {
    changes.push(`Delay count dropped from ${prevDelay} to ${currDelay}`);
  }

  if (!majorish.has(previous.maxSeverity) && majorish.has(current.maxSeverity)) {
    changes.push('Major alert detected');
  }

  if (previous.dataHealthStatus !== current.dataHealthStatus) {
    if (current.dataHealthStatus === 'stale') {
      changes.push('Feed became stale');
    } else if (current.dataHealthStatus === 'live') {
      changes.push('Feed returned live');
    }
  }

  return changes;
}

function getTimeline(lineId) {
  const store = readStore();
  const snapshots = store[lineId] || [];
  const timeline = [];

  for (let i = 1; i < snapshots.length; i += 1) {
    const previous = snapshots[i - 1];
    const current = snapshots[i];
    const changes = deriveChanges(previous, current);

    changes.forEach((text) => {
      timeline.push({
        timestamp: current.timestamp,
        timeLabel: getTimeLabel(current.timestamp),
        text,
      });
    });
  }

  return timeline.slice(-30).reverse();
}

function addSnapshot(lineId, snapshot) {
  if (!lineId || !snapshot) return;

  const store = readStore();
  const existing = store[lineId] || [];
  const last = existing[existing.length - 1];

  if (last && last.timestamp === snapshot.timestamp) {
    return;
  }

  const next = [...existing, snapshot].slice(-50);
  store[lineId] = next;
  writeStore(store);
}

export function useChangeTimeline(lineId, snapshot) {
  const [timeline, setTimeline] = useState(() => (lineId ? getTimeline(lineId) : []));

  useEffect(() => {
    if (!lineId) {
      setTimeline([]);
      return;
    }
    setTimeline(getTimeline(lineId));
  }, [lineId]);

  useEffect(() => {
    if (!lineId || !snapshot) return;
    addSnapshot(lineId, snapshot);
    setTimeline(getTimeline(lineId));
  }, [lineId, snapshot]);

  return {
    timeline,
    addSnapshot,
    getTimeline,
    deriveChanges,
  };
}

export { STORAGE_KEY as CHANGE_TIMELINE_STORAGE_KEY, addSnapshot, getTimeline, deriveChanges };
