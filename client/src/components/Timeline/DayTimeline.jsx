import { riskColour } from '../../utils/riskColour';
import styles from './DayTimeline.module.css';

export default function DayTimeline({ profile }) {
  if (!profile) return null;

  return (
    <div className={styles.container} aria-label="24-hour risk profile">
      <div className={styles.strip}>
        {profile.map(({ hour, risk }) => (
          <div
            key={hour}
            className={styles.cell}
            style={{ backgroundColor: riskColour(risk, 0.7) }}
            title={`${String(hour).padStart(2, '0')}:00 — Risk ${risk}`}
            role="img"
            aria-label={`${hour}:00 risk ${risk}`}
          >
            {risk >= 60 && <span className={styles.highMarker}>!</span>}
          </div>
        ))}
      </div>
      <div className={styles.labels}>
        {[0, 6, 12, 18, 23].map((hour) => (
          <span key={hour} className={styles.label} style={{ left: `${(hour / 23) * 100}%` }}>
            {String(hour).padStart(2, '0')}
          </span>
        ))}
      </div>
    </div>
  );
}
