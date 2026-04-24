import styles from './RiskBreakdown.module.css';

export default function RiskBreakdown({ explanation }) {
  if (!explanation) {
    return (
      <section className={styles.panel}>
        <div className={styles.title}>WHY THIS SCORE?</div>
        <p className={styles.empty}>Select a line to view factor breakdown.</p>
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <div className={styles.top}>
        <span className={styles.title}>WHY THIS SCORE?</span>
        <span className={styles.total}>{explanation.total} · {explanation.label}</span>
      </div>

      <div className={styles.list}>
        {explanation.breakdown.map((item) => (
          <div key={item.factor} className={styles.row} title={item.explanation}>
            <div className={styles.factorCol}>
              <span className={styles.factor}>{item.factor}</span>
              <span className={styles.exp}>{item.explanation}</span>
            </div>
            <span className={styles.points}>+{item.points}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
