import { useEffect, useMemo, useState } from 'react';
import LineCard from './LineCard';
import LoadingPulse from '../shared/LoadingPulse';
import fallbackLines from '../../utils/lineMetadata';
import styles from './Dashboard.module.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const FILTERS = ['All', 'Burnley', 'Caulfield', 'Clifton Hill', 'Cross City', 'Northern', 'Frankston'];

export default function Dashboard({ selectedLine, onSelectLine }) {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [sortBy, setSortBy] = useState('risk');
  const [riskByLine, setRiskByLine] = useState({});

  useEffect(() => {
    const fetchLines = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/lines`);
        if (!res.ok) throw new Error('Failed to fetch lines');
        const json = await res.json();
        setLines(json.lines || fallbackLines);
      } catch (error) {
        setLines(fallbackLines);
      } finally {
        setLoading(false);
      }
    };

    fetchLines();
  }, []);

  const setLineRisk = (lineId, risk) => {
    setRiskByLine((prev) => {
      if (prev[lineId] === risk) return prev;
      return { ...prev, [lineId]: risk };
    });
  };

  const filteredLines = useMemo(() => {
    const byFilter =
      filter === 'All' ? lines : lines.filter((line) => line.group === filter);

    const sorted = [...byFilter].sort((a, b) => {
      if (sortBy === 'alphabetical') return a.name.localeCompare(b.name);

      const riskA = riskByLine[a.id] ?? -1;
      const riskB = riskByLine[b.id] ?? -1;
      if (riskA !== riskB) return riskB - riskA;
      return a.name.localeCompare(b.name);
    });

    return sorted;
  }, [filter, lines, riskByLine, sortBy]);

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.filters} role="tablist" aria-label="Line group filters">
          {FILTERS.map((group) => (
            <button
              key={group}
              type="button"
              className={`${styles.filterBtn} ${filter === group ? styles.active : ''}`}
              onClick={() => setFilter(group)}
            >
              {group}
            </button>
          ))}
        </div>

        <div className={styles.sortWrap}>
          <button
            type="button"
            className={`${styles.sortBtn} ${sortBy === 'risk' ? styles.active : ''}`}
            onClick={() => setSortBy('risk')}
          >
            Risk
          </button>
          <button
            type="button"
            className={`${styles.sortBtn} ${sortBy === 'alphabetical' ? styles.active : ''}`}
            onClick={() => setSortBy('alphabetical')}
          >
            A-Z
          </button>
        </div>
      </header>

      <div className={styles.list}>
        {loading ? (
          <LoadingPulse lines={8} />
        ) : (
          filteredLines.map((line, index) => (
            <LineCard
              key={line.id}
              line={line}
              isSelected={selectedLine === line.id}
              onClick={() => onSelectLine(selectedLine === line.id ? null : line.id)}
              animationDelay={index * 50}
              onRiskUpdate={setLineRisk}
            />
          ))
        )}
      </div>
    </section>
  );
}
