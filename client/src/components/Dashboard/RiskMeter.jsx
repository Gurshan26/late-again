import { useEffect, useRef } from 'react';
import { riskColour } from '../../utils/riskColour';
import styles from './RiskMeter.module.css';

export default function RiskMeter({ score, size = 80 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || score === null || score === undefined) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 6;
    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;
    const progress = (score / 100) * (endAngle - startAngle);
    const color = riskColour(score);

    ctx.clearRect(0, 0, size, size);

    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.stroke();

    if (score > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, startAngle + progress);
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.font = `bold ${Math.round(size * 0.22)}px 'Space Mono', monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(score), cx, cy);
  }, [score, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={styles.meter}
      aria-label={`Risk score: ${score}`}
    />
  );
}
