import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function useAlerts() {
  const [alerts, setAlerts] = useState({ alerts: [], metro: [], trams: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/alerts`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setAlerts(json);
        setError(null);
      } catch (error) {
        setAlerts({ alerts: [], metro: [], trams: [], summary: {} });
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
    const intervalId = setInterval(fetchAlerts, 60_000);
    return () => clearInterval(intervalId);
  }, []);

  return { alerts, loading, error };
}
