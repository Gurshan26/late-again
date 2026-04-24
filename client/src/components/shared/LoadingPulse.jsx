import styles from './LoadingPulse.module.css';

export default function LoadingPulse({ lines = 3 }) {
  return (
    <div className={styles.wrapper} aria-label="Loading">
      {Array.from({ length: lines }).map((_, idx) => (
        <div key={idx} className={styles.row} style={{ animationDelay: `${idx * 120}ms` }} />
      ))}
    </div>
  );
}
