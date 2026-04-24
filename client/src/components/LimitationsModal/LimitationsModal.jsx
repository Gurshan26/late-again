import styles from './LimitationsModal.module.css';

export default function LimitationsModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Data notes">
      <div className={styles.modal}>
        <div className={styles.title}>What this app can and cannot know</div>
        <ul className={styles.list}>
          <li>Live train delays come from PTV GTFS Realtime.</li>
          <li>GTFS Realtime may not include replacement buses, service deviations, platform changes, or every cancellation.</li>
          <li>Weather comes from Open-Meteo.</li>
          <li>Risk scores are estimates, not guarantees.</li>
          <li>If the PTV feed is stale or unavailable, the app falls back to baseline and weather-based predictions.</li>
        </ul>
        <button type="button" className={styles.closeBtn} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
