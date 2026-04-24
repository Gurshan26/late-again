import { useEffect, useMemo, useState } from 'react';
import Dashboard from './components/Dashboard/Dashboard';
import NetworkMap from './components/Map/NetworkMap';
import WeatherBar from './components/WeatherBar/WeatherBar';
import TomorrowCard from './components/TomorrowCard/TomorrowCard';
import ErrorBoundary from './components/shared/ErrorBoundary';
import DataHealthChip from './components/DataHealthChip/DataHealthChip';
import CommuteImpact from './components/CommuteImpact/CommuteImpact';
import TripSetup from './components/TripSetup/TripSetup';
import RiskBreakdown from './components/RiskBreakdown/RiskBreakdown';
import SmartAlertFeed from './components/SmartAlertFeed/SmartAlertFeed';
import ChangeTimeline from './components/ChangeTimeline/ChangeTimeline';
import NearMissBanner from './components/NearMissBanner/NearMissBanner';
import LimitationsModal from './components/LimitationsModal/LimitationsModal';
import { useTripProfile } from './hooks/useTripProfile';
import { useDelayData } from './hooks/useDelayData';
import styles from './App.module.css';

export default function App() {
  const [selectedLine, setSelectedLine] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showNotes, setShowNotes] = useState(false);

  const { profile, saveProfile, clearProfile } = useTripProfile();
  const [tripSetupExpanded, setTripSetupExpanded] = useState(!profile);

  const effectiveLine = selectedLine || profile?.lineId || 'frankston';
  const { data: selectedLineData } = useDelayData(effectiveLine);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!profile) {
      setTripSetupExpanded(true);
    }
  }, [profile]);

  const timeStr = currentTime.toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Australia/Melbourne',
  });

  const dateStr = currentTime.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Australia/Melbourne',
  });

  const snapshot = useMemo(() => {
    if (!selectedLineData) return null;
    return {
      timestamp: selectedLineData.timestamp || new Date().toISOString(),
      lineId: effectiveLine,
      risk: selectedLineData.currentRisk,
      alertCount: selectedLineData.hasAlert ? 1 : 0,
      maxSeverity: selectedLineData.maxAlertSeverity,
      totalDelaySeconds: selectedLineData.totalActiveDelaySecs,
      activeDelayCount: selectedLineData.activeDelayCount,
      dataHealthStatus: selectedLineData.dataHealth?.status || 'unknown',
    };
  }, [effectiveLine, selectedLineData]);

  const ptvFeedHealth = selectedLineData?.dataHealth?.feeds?.ptv || selectedLineData?.dataHealth;

  return (
    <ErrorBoundary>
      <div className={styles.app}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.logo}>
              LATE<span className={styles.logoAccent}>?</span>
            </span>
            <span className={styles.tagline}>Melbourne Transit Risk Intelligence</span>
          </div>

          <div className={styles.headerCenter}>
            <DataHealthChip health={ptvFeedHealth} />
          </div>

          <div className={styles.headerRight}>
            <button type="button" className={styles.notesBtn} onClick={() => setShowNotes(true)}>
              Data notes
            </button>
            <span className={styles.clock}>{timeStr}</span>
            <span className={styles.date}>{dateStr}</span>
          </div>
        </header>

        <CommuteImpact profile={profile} onSetupTrip={() => setTripSetupExpanded(true)} />
        <NearMissBanner nearMiss={selectedLineData?.nearMiss} />
        <WeatherBar />

        <main className={styles.main}>
          <section className={styles.mapSection}>
            <NetworkMap selectedLine={selectedLine} onSelectLine={setSelectedLine} />
          </section>

          <aside className={styles.sidebar}>
            <TripSetup
              profile={profile}
              saveProfile={saveProfile}
              clearProfile={clearProfile}
              expanded={tripSetupExpanded}
              onToggle={setTripSetupExpanded}
            />
            <TomorrowCard selectedLine={effectiveLine} />
            <Dashboard selectedLine={selectedLine} onSelectLine={setSelectedLine} />
            <RiskBreakdown explanation={selectedLineData?.explanation} />
            <ChangeTimeline lineId={effectiveLine} snapshot={snapshot} />
            <SmartAlertFeed profile={profile} />
          </aside>
        </main>
      </div>

      <LimitationsModal open={showNotes} onClose={() => setShowNotes(false)} />
    </ErrorBoundary>
  );
}
