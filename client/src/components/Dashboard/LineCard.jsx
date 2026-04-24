import { useEffect } from 'react';
import RiskMeter from './RiskMeter';
import DayTimeline from '../Timeline/DayTimeline';
import { useDelayData } from '../../hooks/useDelayData';
import { riskColour, riskLabel } from '../../utils/riskColour';
import styles from './LineCard.module.css';

export default function LineCard({
  line,
  isSelected,
  onClick,
  animationDelay,
  onRiskUpdate,
}) {
  const { data, loading } = useDelayData(line.id);

  const risk = data?.currentRisk ?? null;
  const colour = risk !== null ? riskColour(risk) : 'var(--text-secondary)';
  const label = risk !== null ? riskLabel(risk) : '...';

  useEffect(() => {
    if (risk !== null && onRiskUpdate) {
      onRiskUpdate(line.id, risk);
    }
  }, [line.id, onRiskUpdate, risk]);

  return (
    <article
      className={`${styles.card} ${isSelected ? styles.selected : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => event.key === 'Enter' && onClick()}
      aria-label={`${line.name} line — risk ${label}`}
      style={{ '--line-colour': line.colour, animationDelay: `${animationDelay}ms` }}
    >
      <div className={styles.stripe} />
      <div className={styles.body}>
        <div className={styles.top}>
          <div className={styles.nameBlock}>
            <span className={styles.name}>{line.name}</span>
            <span className={styles.group}>{line.group} Group</span>
          </div>

          {loading ? (
            <span className={styles.loading}>···</span>
          ) : (
            <div className={styles.riskBlock}>
              <RiskMeter score={risk} size={56} />
            </div>
          )}
        </div>

        <div className={styles.meta}>
          <span className={styles.riskLabel} style={{ color: colour }}>
            {label}
          </span>
          {data?.hasAlert && <span className={styles.alertBadge}>ALERT</span>}
          {data?.activeDelayCount > 0 && (
            <span className={styles.delayBadge}>
              {data.activeDelayCount} delay{data.activeDelayCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {isSelected && data?.profile24h && <DayTimeline profile={data.profile24h} />}
      </div>
    </article>
  );
}
