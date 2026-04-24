import styles from './DataHealthChip.module.css';

function ageText(ageSeconds) {
  if (ageSeconds === null || ageSeconds === undefined) return 'no recent update';
  if (ageSeconds < 60) return `${ageSeconds}s ago`;
  const minutes = Math.round(ageSeconds / 60);
  return `${minutes}m ago`;
}

export default function DataHealthChip({ health }) {
  const status = (health && health.status) || 'unknown';
  const label = status.toUpperCase();
  const age = ageText(health && health.ageSeconds);

  return (
    <div className={`${styles.chip} ${styles[status] || styles.unknown}`} title={health?.message || 'Feed status unavailable'}>
      <span className={styles.key}>PTV FEED:</span>
      <span className={styles.value}>{label}</span>
      <span className={styles.sep}>·</span>
      <span className={styles.age}>{age}</span>
    </div>
  );
}
