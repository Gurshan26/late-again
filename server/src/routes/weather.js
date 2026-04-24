const express = require('express');
const { getWeatherForecast, toMelbourneHourString } = require('../services/weather');
const { combineHealth } = require('../services/dataHealth');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const data = await getWeatherForecast();
    const nowHour = toMelbourneHourString(new Date());
    const exactIndex = data.hourly.time.indexOf(nowHour);
    const futureIndex = data.hourly.time.findIndex((hour) => hour > nowHour);
    const idx = exactIndex !== -1 ? exactIndex : (futureIndex !== -1 ? futureIndex : 0);

    res.json({
      current: {
        time: data.hourly.time[idx],
        temperature: data.hourly.temperature_2m[idx],
        precipitation: data.hourly.precipitation[idx],
        windSpeed: data.hourly.wind_speed_10m[idx],
        weatherCode: data.hourly.weather_code[idx],
      },
      next24h: {
        times: data.hourly.time.slice(idx, idx + 24),
        precipitation: data.hourly.precipitation.slice(idx, idx + 24),
        windSpeed: data.hourly.wind_speed_10m.slice(idx, idx + 24),
        temperature: data.hourly.temperature_2m.slice(idx, idx + 24),
        weatherCode: data.hourly.weather_code.slice(idx, idx + 24),
      },
      timezone: data.timezone,
      dataHealth: combineHealth(['weather']),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
