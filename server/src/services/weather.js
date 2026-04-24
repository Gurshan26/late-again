const fetch = require('node-fetch');
const cache = require('./cache');
const { markSuccess, markFailure } = require('./dataHealth');

const MEL_LAT = -37.8136;
const MEL_LON = 144.9631;

function toMelbourneHourString(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Melbourne',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const part = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  return `${part.year}-${part.month}-${part.day}T${part.hour}:00`;
}

async function getWeatherForecast() {
  const cached = cache.get('weather_forecast');
  if (cached) return cached;

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', MEL_LAT);
  url.searchParams.set('longitude', MEL_LON);
  url.searchParams.set('hourly', 'precipitation,wind_speed_10m,weather_code,temperature_2m');
  url.searchParams.set('forecast_days', '2');
  url.searchParams.set('timezone', 'Australia/Melbourne');

  try {
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);

    const data = await res.json();
    cache.set('weather_forecast', data, 3600);
    cache.set('weather_forecast_stale', data, 10_800);
    markSuccess('weather');
    return data;
  } catch (error) {
    markFailure('weather', error);
    const stale = cache.get('weather_forecast_stale');
    if (stale) return stale;
    if (cached) return cached;
    throw error;
  }
}

function weatherRiskFactor(hourlyData, isoHour) {
  const idx = hourlyData.time.indexOf(isoHour);
  if (idx === -1) return 0;

  const rain = hourlyData.precipitation[idx] || 0;
  const wind = hourlyData.wind_speed_10m[idx] || 0;
  const code = hourlyData.weather_code[idx] || 0;

  let risk = 0;
  if (rain > 0) risk += Math.min(rain / 20, 0.4);
  if (wind > 30) risk += Math.min((wind - 30) / 40, 0.3);

  if (code >= 95) risk += 0.3;
  else if (code >= 65) risk += 0.2;
  else if (code >= 61) risk += 0.1;

  return Math.min(Math.max(risk, 0), 1);
}

module.exports = {
  getWeatherForecast,
  weatherRiskFactor,
  toMelbourneHourString,
};
