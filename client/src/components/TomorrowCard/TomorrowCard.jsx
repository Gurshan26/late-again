import { useMemo } from 'react';
import { useDelayData } from '../../hooks/useDelayData';
import { useWeather } from '../../hooks/useWeather';
import { riskColour, riskLabel } from '../../utils/riskColour';
import lines from '../../utils/lineMetadata';
import RiskMeter from '../Dashboard/RiskMeter';
import styles from './TomorrowCard.module.css';

const WEATHER_LABELS = {
  0: 'CLEAR',
  1: 'PARTLY CLOUDY',
  3: 'CLOUDY',
  45: 'FOG',
  61: 'RAIN',
  71: 'SNOW',
  95: 'STORM',
};

function weatherLabel(code) {
  const keys = Object.keys(WEATHER_LABELS)
    .map(Number)
    .sort((a, b) => b - a);

  const match = keys.find((k) => code >= k);
  return WEATHER_LABELS[match ?? 0];
}

export default function TomorrowCard({ selectedLine }) {
  const lineId = selectedLine || 'frankston';
  const { data } = useDelayData(lineId);
  const { weather } = useWeather();

  const lineName = useMemo(() => {
    const line = lines.find((entry) => entry.id === lineId);
    return line ? line.name : 'Selected Line';
  }, [lineId]);

  const score = data?.tomorrowMorningRisk ?? null;
  const color = score !== null ? riskColour(score) : 'var(--text-secondary)';

  const tomorrowPrecip = weather?.next24h?.precipitation?.[8] ?? 0;
  const tomorrowCode = weather?.next24h?.weatherCode?.[8] ?? 0;
  const tomorrowTemp = weather?.next24h?.temperature?.[8] ?? null;

  return (
    <section className={styles.card}>
      <div className={styles.eyebrow}>TOMORROW MORNING OUTLOOK</div>
      <div className={styles.lineTag}>{lineName.toUpperCase()}</div>

      <div className={styles.scoreRow}>
        <RiskMeter score={score} size={100} />
        <div className={styles.scoreInfo}>
          <span className={styles.riskLabel} style={{ color }}>
            {score !== null ? riskLabel(score) : '—'}
          </span>
          <span className={styles.scoreNum} style={{ color }}>
            {score !== null ? `${score}/100` : '—'}
          </span>
        </div>
      </div>

      <div className={styles.weatherRow}>
        <span className={styles.weatherDetail}>{weatherLabel(tomorrowCode)}</span>
        <span className={styles.weatherDetail}>
          {tomorrowTemp !== null ? `${Math.round(tomorrowTemp)}°C` : '—'}
        </span>
        <span className={styles.weatherDetail}>{`Rain ${tomorrowPrecip.toFixed(1)}mm`}</span>
      </div>

      <p className={styles.advice}>
        {score === null
          ? 'Loading prediction...'
          : score >= 70
            ? 'High disruption risk. Allow extra time or plan an alternate route.'
            : score >= 45
              ? 'Moderate risk. Keep an eye on live updates before departure.'
              : 'Low disruption risk predicted for the morning window.'}
      </p>
    </section>
  );
}
