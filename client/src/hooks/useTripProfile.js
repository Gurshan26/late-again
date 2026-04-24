import { useEffect, useState } from 'react';

const STORAGE_KEY = 'late-again-trip-profile-v1';

function normalizeStation(station, fallbackIdPrefix) {
  if (!station) return null;

  if (typeof station === 'string') {
    const name = station.trim();
    if (!name) return null;
    return {
      id: `${fallbackIdPrefix}:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name,
    };
  }

  const name = String(station.name || '').trim();
  const id = String(station.id || '').trim();
  if (!name) return null;

  return {
    id: id || `${fallbackIdPrefix}:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
  };
}

function migrateProfileShape(input) {
  if (!input || typeof input !== 'object') return null;

  const origin = normalizeStation(input.origin, 'origin');
  const destination = normalizeStation(input.destination, 'dest');
  const primaryLineId = input.primaryLineId || input.lineId || 'frankston';

  return {
    id: input.id || `trip-${Date.now()}`,
    name: input.name || 'My commute',
    origin,
    destination,
    date: input.date || new Date().toISOString().slice(0, 10),
    time: input.time || input.usualDeparture || '08:10',
    timeMode: input.timeMode === 'arrive' ? 'arrive' : 'depart',
    bufferMinutes: Number(input.bufferMinutes || 0),
    selectedOptionId: input.selectedOptionId || null,
    selectedOptionSummary: input.selectedOptionSummary || null,
    primaryLineId,
    lineId: primaryLineId,
    legs: Array.isArray(input.legs) ? input.legs : [],
  };
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return migrateProfileShape(JSON.parse(raw));
  } catch (error) {
    return null;
  }
}

export function useTripProfile() {
  const [profile, setProfile] = useState(() => loadProfile());

  useEffect(() => {
    if (!profile) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }, [profile]);

  function saveProfile(nextProfile) {
    const normalized = migrateProfileShape(nextProfile);
    if (!normalized) return;

    setProfile(normalized);
  }

  function clearProfile() {
    setProfile(null);
  }

  return {
    profile,
    saveProfile,
    clearProfile,
  };
}

export { STORAGE_KEY as TRIP_PROFILE_STORAGE_KEY };
