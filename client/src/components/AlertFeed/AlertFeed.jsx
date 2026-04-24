import { useAlerts } from '../../hooks/useAlerts';
import styles from './AlertFeed.module.css';

const EFFECT_LABELS = {
  1: 'NO_SERVICE',
  2: 'REDUCED_SERVICE',
  3: 'SIGNIFICANT_DELAYS',
  4: 'DETOUR',
  5: 'ADDITIONAL_SERVICE',
  6: 'MODIFIED_SERVICE',
  7: 'OTHER_EFFECT',
  8: 'UNKNOWN_EFFECT',
  9: 'STOP_MOVED',
};

export default function AlertFeed() {
  const { alerts, loading } = useAlerts();

  if (loading) {
    return (
      <div className={styles.bar}>
        <span className={styles.item}>Fetching live alerts...</span>
      </div>
    );
  }

  const allAlerts = [...(alerts?.metro || []), ...(alerts?.trams || [])];

  if (allAlerts.length === 0) {
    return (
      <div className={styles.bar}>
        <span className={styles.item} style={{ color: 'var(--accent-safe)' }}>
          No active disruptions. All lines operating normally.
        </span>
      </div>
    );
  }

  const items = [...allAlerts, ...allAlerts];

  return (
    <div className={styles.bar} role="marquee" aria-label="Live alert feed">
      <span className={styles.label}>ALERTS</span>
      <div className={styles.track}>
        <div className={styles.scroll}>
          {items.map((alert, index) => (
            <span key={`${alert.id}-${index}`} className={styles.item}>
              <span className={styles.dot} />
              <span className={styles.effect}>{EFFECT_LABELS[alert.effect] || 'ALERT'}</span>
              {alert.header || alert.description?.slice(0, 80) || 'Network disruption'}
              <span className={styles.divider}>|</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
