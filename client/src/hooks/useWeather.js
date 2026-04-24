import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function useWeather() {
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/weather`);
        const json = await res.json();
        setWeather(json);
      } catch (error) {
        setWeather(null);
      }
    };

    fetchWeather();
    const intervalId = setInterval(fetchWeather, 3_600_000);
    return () => clearInterval(intervalId);
  }, []);

  return { weather };
}
