import { useCallback, useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const POLL_INTERVAL = 30_000;

export function useDelayData(lineId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDelayData = useCallback(async () => {
    if (!lineId) return;

    try {
      const res = await fetch(`${API_BASE}/api/predict/${lineId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [lineId]);

  useEffect(() => {
    if (!lineId) {
      setData(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    fetchDelayData();

    const intervalId = setInterval(fetchDelayData, POLL_INTERVAL);
    return () => clearInterval(intervalId);
  }, [fetchDelayData, lineId]);

  return { data, loading, error };
}
