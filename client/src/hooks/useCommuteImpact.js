import { useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function buildUrl(profile) {
  const url = new URL(`${API_BASE}/api/commute/impact`);
  if (!profile) return url.toString();

  const primaryLineId = profile.primaryLineId || profile.lineId || 'frankston';
  url.searchParams.set('lineId', primaryLineId);
  url.searchParams.set('primaryLineId', primaryLineId);
  if (profile.origin?.name) url.searchParams.set('origin', profile.origin.name);
  if (profile.destination?.name) url.searchParams.set('destination', profile.destination.name);
  if (profile.bufferMinutes !== undefined && profile.bufferMinutes !== null) {
    url.searchParams.set('bufferMinutes', String(profile.bufferMinutes));
  }
  if (profile.time) url.searchParams.set('departureTime', profile.time);
  if (profile.timeMode) url.searchParams.set('timeMode', profile.timeMode);

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
