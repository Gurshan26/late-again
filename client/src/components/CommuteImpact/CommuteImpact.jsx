import { useCommuteImpact } from '../../hooks/useCommuteImpact';
import DataHealthChip from '../DataHealthChip/DataHealthChip';
import styles from './CommuteImpact.module.css';

export default function CommuteImpact({ profile, onSetupTrip }) {
  const { impact, loading } = useCommuteImpact(profile);

  if (!profile) {
    return (
      <section className={styles.panel}>
        <div className={styles.title}>COMMUTE IMPACT</div>
        <p className={styles.message}>Add your usual trip to get personalised disruption advice.</p>
        <button type="button" className={styles.button} onClick={onSetupTrip}>
          Set up trip
        </button>
      </section>
    );
  }

  if (loading) {
    return (
      <section className={styles.panel}>
        <div className={styles.title}>COMMUTE IMPACT</div>
        <p className={styles.message}>Analysing your saved commute...</p>
      </section>
    );
  }

  return (
    <section className={`${styles.panel} ${styles[impact?.status || 'unknown']}`}>
      <div className={styles.headerRow}>
        <div className={styles.title}>COMMUTE IMPACT</div>
        <DataHealthChip health={impact?.dataHealth} />
      </div>

      <p className={styles.headline}>{impact?.headline || 'Commute status unavailable.'}</p>

      <div className={styles.metaRow}>
        <span className={styles.meta}>Risk: {impact?.risk?.score ?? '—'}</span>
        <span className={styles.meta}>Confidence: {impact?.recommendation?.confidence ? `${Math.round(impact.recommendation.confidence * 100)}%` : '—'}</span>
        <span className={styles.meta}>Action: {impact?.recommendation?.action || 'monitor'}</span>
      </div>
    </section>
  );
}
