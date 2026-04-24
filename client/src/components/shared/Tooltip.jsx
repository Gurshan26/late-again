import styles from './Tooltip.module.css';

export default function Tooltip({ children, label }) {
  return (
    <span className={styles.wrap}>
      {children}
      <span className={styles.tip}>{label}</span>
    </span>
  );
}
