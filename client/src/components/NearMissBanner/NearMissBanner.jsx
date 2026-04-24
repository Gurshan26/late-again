import styles from './NearMissBanner.module.css';

export default function NearMissBanner({ nearMiss }) {
  if (!nearMiss || !nearMiss.isNearMiss) return null;

  return (
    <section className={styles.banner}>
      <div className={styles.title}>EARLY WARNING</div>
      <div className={styles.message}>{nearMiss.message}</div>
      <ul className={styles.reasons}>
        {(nearMiss.reasons || []).map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </section>
  );
}
