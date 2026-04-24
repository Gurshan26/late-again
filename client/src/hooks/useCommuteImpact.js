import { useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function buildUrl(profile) {
  const url = new URL(`${API_BASE}/api/commute/impact`);
  if (!profile) return url.toString();

  url.searchParams.set('lineId', profile.lineId || 'frankston');
  if (profile.origin) url.searchParams.set('origin', profile.origin);
  if (profile.destination) url.searchParams.set('destination', profile.destination);
  if (profile.bufferMinutes !== undefined && profile.bufferMinutes !== null) {
    url.searchParams.set('bufferMinutes', String(profile.bufferMinutes));
  }
  if (profile.usualDeparture) url.searchParams.set('departureTime', profile.usualDeparture);
  if (profile.preferredArrival) url.searchParams.set('preferredArrival', profile.preferredArrival);

  return url.toString();
}

export function useCommuteImpact(profile) {
  const [impact, setImpact] = useState(null);
  const [loading, setLoading] = useState(Boolean(profile));
  const [error, setError] = useState(null);

  const url = useMemo(() => buildUrl(profile), [profile]);

  useEffect(() => {
    if (!profile) {
      setImpact(null);
      setLoading(false);
      setError(null);
      return undefined;
    }

    let mounted = true;

    const fetchImpact = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!mounted) return;
        setImpact(json);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    setLoading(true);
    fetchImpact();
    const intervalId = setInterval(fetchImpact, 60_000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [profile, url]);

  return { impact, loading, error };
}
