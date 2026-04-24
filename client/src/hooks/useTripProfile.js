import { useEffect, useState } from 'react';

const STORAGE_KEY = 'late-again-trip-profile-v1';

function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
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
    const normalized = {
      id: nextProfile.id || `trip-${Date.now()}`,
      name: nextProfile.name || 'My commute',
      origin: nextProfile.origin || '',
      destination: nextProfile.destination || '',
      lineId: nextProfile.lineId || 'frankston',
      direction: nextProfile.direction || 'citybound',
      usualDeparture: nextProfile.usualDeparture || '',
      preferredArrival: nextProfile.preferredArrival || '',
      bufferMinutes: Number(nextProfile.bufferMinutes || 0),
    };

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
