import { useMemo } from 'react';
import { useWeather } from '../../hooks/useWeather';
import styles from './WeatherBar.module.css';

const CODE_LABEL = {
  0: 'CLEAR',
  1: 'MAINLY_CLEAR',
  2: 'PARTLY_CLOUDY',
  3: 'CLOUDY',
  45: 'FOG',
  61: 'RAIN',
  71: 'SNOW',
  95: 'STORM',
};

function weatherImpact(rain, wind, code) {
  let score = 0;
  if (rain > 0) score += Math.min(rain / 20, 0.4);
  if (wind > 30) score += Math.min((wind - 30) / 40, 0.3);
  if (code >= 95) score += 0.3;
  else if (code >= 65) score += 0.2;
  else if (code >= 61) score += 0.1;

  if (score >= 0.65) return 'High';
  if (score >= 0.4) return 'Moderate';
  if (score > 0) return 'Low';
  return 'None';
}

export default function WeatherBar() {
  const { weather } = useWeather();

  const content = useMemo(() => {
    if (!weather) {
      return {
        temperature: '--',
        precipitation: Array(6).fill(0),
        windSpeed: '--',
        codeLabel: 'LOADING',
        impact: 'None',
      };
    }

    const temp = weather.current?.temperature;
    const precip = (weather.next24h?.precipitation || []).slice(0, 6);
    const wind = weather.current?.windSpeed ?? 0;
    const code = weather.current?.weatherCode ?? 0;

    const label =
      Object.keys(CODE_LABEL)
        .map(Number)
        .sort((a, b) => b - a)
        .find((k) => code >= k) ?? 0;

    return {
      temperature: Number.isFinite(temp) ? `${Math.round(temp)}°C` : '--',
      precipitation: precip.length ? precip : Array(6).fill(0),
      windSpeed: Number.isFinite(wind) ? `${Math.round(wind)} km/h` : '--',
      codeLabel: CODE_LABEL[label],
      impact: weatherImpact(weather.current?.precipitation ?? 0, wind, code),
    };
  }, [weather]);

  return (
    <section className={styles.bar} aria-label="Weather context">
      <div className={styles.segment}>
        <span className={styles.key}>NOW</span>
        <span className={styles.value}>{content.codeLabel}</span>
        <span className={styles.valueMono}>{content.temperature}</span>
      </div>

      <div className={styles.segmentGrow}>
        <span className={styles.key}>NEXT 6H RAIN</span>
        <div className={styles.chart}>
          {content.precipitation.map((mm, index) => {
            const height = Math.max(10, Math.min(mm * 12, 42));
            return (
              <div key={index} className={styles.barCol}>
                <span className={styles.barFill} style={{ height }} />
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.segment}>
        <span className={styles.key}>WIND</span>
        <span className={styles.valueMono}>{content.windSpeed}</span>
      </div>

      <div className={styles.segment}>
        <span className={styles.key}>WEATHER IMPACT</span>
        <span className={styles.impact} data-impact={content.impact.toLowerCase()}>
          {content.impact}
        </span>
      </div>
    </section>
  );
}
