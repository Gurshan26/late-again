import { useMemo, useState } from 'react';
import { useAlerts } from '../../hooks/useAlerts';
import {
  ROUTE_ID_MAP,
  severityTone,
  sortAlertsBySeverity,
  isAlertActiveNow,
} from '../../utils/severity';
import styles from './SmartAlertFeed.module.css';

function inferAction(alert) {
  if (alert.category === 'replacement_bus') return 'Check replacement bus details';
  if (alert.severity === 'critical') return 'Avoid this route now';
  if (alert.severity === 'major') return 'Leave earlier than usual';
  if (alert.severity === 'moderate') return 'Monitor updates before departing';
  return 'Probably safe for most trips';
}

function inferConfidence(alert) {
  if (alert.severity === 'critical') return 0.85;
  if (alert.severity === 'major') return 0.75;
  if (alert.severity === 'moderate') return 0.62;
  if (alert.severity === 'minor') return 0.5;
  return 0.4;
}

function affectsTrip(alert, profile) {
  if (!profile) return false;

  const routeMatch = (alert.routes || []).some((routeId) => ROUTE_ID_MAP[routeId] === profile.lineId);
  if (routeMatch) return true;

  if (!alert.facilityOnly) return false;

  const text = `${alert.header} ${alert.description} ${alert.plainEnglish}`.toLowerCase();
  return [profile.origin, profile.destination]
    .filter(Boolean)
    .some((station) => text.includes(String(station).toLowerCase()));
}

export default function SmartAlertFeed({ profile }) {
  const { alerts, loading } = useAlerts();
  const [filter, setFilter] = useState('all');
  const [showMinor, setShowMinor] = useState(false);

  const ranked = useMemo(() => {
    const rawAlerts = sortAlertsBySeverity(alerts?.alerts || []);

    return rawAlerts.filter((alert) => {
      const tripHit = affectsTrip(alert, profile);

      if (!showMinor && (alert.severity === 'minor' || alert.facilityOnly) && !tripHit) {
        return false;
      }

      if (filter === 'my') return tripHit;
      if (filter === 'critical') return alert.severity === 'critical';
      if (filter === 'planned') return alert.planned;
      if (filter === 'unplanned') return !alert.planned && isAlertActiveNow(alert);
      return true;
    });
  }, [alerts, filter, profile, showMinor]);

  return (
    <section className={styles.panel}>
      <div className={styles.headRow}>
        <span className={styles.title}>ALERT INTELLIGENCE</span>
        <button type="button" className={styles.toggleMinor} onClick={() => setShowMinor((prev) => !prev)}>
          {showMinor ? 'Hide minor' : 'Show minor'}
        </button>
      </div>

      <div className={styles.filters}>
        {[
          ['all', 'All'],
          ['my', 'My trips'],
          ['critical', 'Critical only'],
          ['planned', 'Planned'],
          ['unplanned', 'Unplanned now'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`${styles.filterBtn} ${filter === id ? styles.active : ''}`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className={styles.empty}>Loading alert intelligence...</p>
      ) : ranked.length === 0 ? (
        <p className={styles.empty}>No relevant alerts for the selected filters.</p>
      ) : (
        <div className={styles.list}>
          {ranked.map((alert) => {
            const tripHit = affectsTrip(alert, profile);
            const tone = severityTone(alert.severity);
            const confidence = Math.round(inferConfidence(alert) * 100);

            return (
              <article key={alert.id} className={`${styles.card} ${styles[tone]}`}>
                <div className={styles.row1}>
                  <span className={styles.severity}>{alert.severity.toUpperCase()}</span>
                  <span className={styles.mode}>{alert.mode.toUpperCase()}</span>
                  <span className={styles.category}>{alert.category.replace(/_/g, ' ')}</span>
                  {tripHit && <span className={styles.tripBadge}>MY TRIP</span>}
                </div>

                <div className={styles.header}>{alert.header || 'Service alert'}</div>
                <div className={styles.summary}>{alert.plainEnglish}</div>

                <div className={styles.row2}>
                  <span>Action: {inferAction(alert)}</span>
                  <span>Confidence: {confidence}%</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
