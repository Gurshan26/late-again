import { useChangeTimeline } from '../../hooks/useChangeTimeline';
import styles from './ChangeTimeline.module.css';

export default function ChangeTimeline({ lineId, snapshot }) {
  const { timeline } = useChangeTimeline(lineId, snapshot);

  return (
    <section className={styles.panel}>
      <div className={styles.title}>WHAT CHANGED?</div>

      {!lineId ? (
        <p className={styles.empty}>Select a line to view change history.</p>
      ) : timeline.length === 0 ? (
        <p className={styles.empty}>No change history yet. Keep this page open to track changes.</p>
      ) : (
        <div className={styles.list}>
          {timeline.map((item, idx) => (
            <div key={`${item.timestamp}-${idx}`} className={styles.row}>
              <span className={styles.time}>{item.timeLabel}</span>
              <span className={styles.text}>{item.text}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
