import { useEffect, useMemo, useState } from 'react';
import { riskColour, riskLabel } from '../../utils/riskColour';
import styles from './TripSetup.module.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function defaultForm(profile) {
  return {
    name: profile?.name || 'Morning commute',
    originInput: profile?.origin?.name || '',
    destinationInput: profile?.destination?.name || '',
    originStation: profile?.origin || null,
    destinationStation: profile?.destination || null,
    date: profile?.date || todayDate(),
    time: profile?.time || '08:10',
    timeMode: profile?.timeMode === 'arrive' ? 'arrive' : 'depart',
    bufferMinutes: Number(profile?.bufferMinutes ?? 12),
  };
}

function toClock(dateTimeString) {
  if (!dateTimeString) return '--:--';
  const [, time = ''] = dateTimeString.split('T');
  return time.slice(0, 5) || '--:--';
}

function formatOptionSummary(option) {
  const dep = toClock(option.departureTime);
  const arr = toClock(option.arrivalTime);
  return `${dep} → ${arr} (${option.durationMinutes}m, ${option.transferCount} transfer${option.transferCount === 1 ? '' : 's'})`;
}

function optionReason(emptyReason) {
  if (emptyReason === 'no_service_window') {
    return 'No services found for this time window.';
  }
  if (emptyReason === 'invalid_input') {
    return 'Trip input is invalid. Please reselect stations and time.';
  }
  return 'No journey options found for this origin/destination at the selected time.';
}

export default function TripSetup({
  profile,
  saveProfile,
  clearProfile,
  expanded,
  onToggle,
}) {
  const [form, setForm] = useState(defaultForm(profile));
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [activeField, setActiveField] = useState(null);
  const [routesState, setRoutesState] = useState({
    loading: false,
    error: null,
    options: [],
    partialSearch: false,
    emptyReason: null,
  });
  const [validationError, setValidationError] = useState(null);

  useEffect(() => {
    setForm(defaultForm(profile));
    setRoutesState({
      loading: false,
      error: null,
      options: [],
      partialSearch: false,
      emptyReason: null,
    });
    setValidationError(null);
  }, [profile]);

  const canSearch = useMemo(() => {
    if (!form.originStation || !form.destinationStation) return false;
    if (!form.date || !form.time) return false;
    return form.originStation.id !== form.destinationStation.id;
  }, [form]);

  useEffect(() => {
    let cancelled = false;
    if (!expanded) return undefined;
    const q = form.originInput.trim();

    if (!q || q.length < 2) {
      setOriginSuggestions([]);
      return undefined;
    }

    const fetchSuggestions = async () => {
      try {
        const url = new URL(`${API_BASE}/api/planner/stations`);
        url.searchParams.set('query', q);
        url.searchParams.set('limit', '8');
        const res = await fetch(url.toString());
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) {
          setOriginSuggestions(json.stations || []);
        }
      } catch (_) {
        if (!cancelled) setOriginSuggestions([]);
      }
    };

    fetchSuggestions();
    return () => {
      cancelled = true;
    };
  }, [expanded, form.originInput]);

  useEffect(() => {
    let cancelled = false;
    if (!expanded) return undefined;
    const q = form.destinationInput.trim();

    if (!q || q.length < 2) {
      setDestinationSuggestions([]);
      return undefined;
    }

    const fetchSuggestions = async () => {
      try {
        const url = new URL(`${API_BASE}/api/planner/stations`);
        url.searchParams.set('query', q);
        url.searchParams.set('limit', '8');
        const res = await fetch(url.toString());
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) {
          setDestinationSuggestions(json.stations || []);
        }
      } catch (_) {
        if (!cancelled) setDestinationSuggestions([]);
      }
    };

    fetchSuggestions();
    return () => {
      cancelled = true;
    };
  }, [expanded, form.destinationInput]);

  function setField(name, value) {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function onOriginChange(value) {
    setForm((prev) => {
      const keepSelected = prev.originStation && prev.originStation.name.toLowerCase() === value.toLowerCase();
      return {
        ...prev,
        originInput: value,
        originStation: keepSelected ? prev.originStation : null,
      };
    });
    setValidationError(null);
  }

  function onDestinationChange(value) {
    setForm((prev) => {
      const keepSelected = prev.destinationStation && prev.destinationStation.name.toLowerCase() === value.toLowerCase();
      return {
        ...prev,
        destinationInput: value,
        destinationStation: keepSelected ? prev.destinationStation : null,
      };
    });
    setValidationError(null);
  }

  function pickOrigin(station) {
    setForm((prev) => ({
      ...prev,
      originInput: station.name,
      originStation: station,
    }));
    setOriginSuggestions([]);
    setActiveField(null);
  }

  function pickDestination(station) {
    setForm((prev) => ({
      ...prev,
      destinationInput: station.name,
      destinationStation: station,
    }));
    setDestinationSuggestions([]);
    setActiveField(null);
  }

  async function findRoutes(event) {
    event.preventDefault();
    setValidationError(null);
    setRoutesState((prev) => ({ ...prev, error: null }));

    if (!form.originStation || !form.destinationStation) {
      setValidationError('Select a valid origin and destination from the station list.');
      return;
    }

    if (form.originStation.id === form.destinationStation.id) {
      setValidationError('Origin and destination must be different stations.');
      return;
    }

    try {
      setRoutesState({
        loading: true,
        error: null,
        options: [],
        partialSearch: false,
        emptyReason: null,
      });

      const url = new URL(`${API_BASE}/api/planner/options`);
      url.searchParams.set('originId', form.originStation.id);
      url.searchParams.set('destinationId', form.destinationStation.id);
      url.searchParams.set('date', form.date);
      url.searchParams.set('time', form.time);
      url.searchParams.set('timeMode', form.timeMode);
      url.searchParams.set('maxOptions', '6');

      const res = await fetch(url.toString());
      const json = await res.json();

      if (!res.ok) {
        setRoutesState({
          loading: false,
          error: json.error || 'Failed to fetch journey options.',
          options: [],
          partialSearch: false,
          emptyReason: json.emptyReason || 'invalid_input',
        });
        return;
      }

      setRoutesState({
        loading: false,
        error: null,
        options: json.options || [],
        partialSearch: Boolean(json.partialSearch),
        emptyReason: json.emptyReason || null,
      });
    } catch (error) {
      setRoutesState({
        loading: false,
        error: error.message || 'Failed to fetch journey options.',
        options: [],
        partialSearch: false,
        emptyReason: null,
      });
    }
  }

  function useOption(option) {
    const summary = formatOptionSummary(option);
    const primaryLineId = option.primaryLineId || profile?.primaryLineId || 'frankston';

    saveProfile({
      id: profile?.id,
      name: form.name,
      origin: form.originStation,
      destination: form.destinationStation,
      date: form.date,
      time: form.time,
      timeMode: form.timeMode,
      bufferMinutes: form.bufferMinutes,
      selectedOptionId: option.id,
      selectedOptionSummary: summary,
      primaryLineId,
      lineId: primaryLineId,
      legs: option.legs || [],
    });

    onToggle(false);
  }

  if (!expanded && profile) {
    return (
      <section className={styles.panel}>
        <div className={styles.rowTop}>
          <span className={styles.title}>SAVED TRIP</span>
          <button type="button" className={styles.linkBtn} onClick={() => onToggle(true)}>
            Edit
          </button>
        </div>
        <p className={styles.summary}>
          {profile.name}: {profile.origin?.name || 'Origin'} → {profile.destination?.name || 'Destination'}
        </p>
        {profile.selectedOptionSummary && (
          <p className={styles.optionSummary}>Option: {profile.selectedOptionSummary}</p>
        )}
        <button type="button" className={styles.clearBtn} onClick={clearProfile}>Clear trip</button>
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <div className={styles.rowTop}>
        <span className={styles.title}>TRIP SETUP</span>
        {profile && (
          <button type="button" className={styles.linkBtn} onClick={() => onToggle(false)}>
            Collapse
          </button>
        )}
      </div>

      <form className={styles.form} onSubmit={findRoutes}>
        <label className={styles.field}>
          <span>Trip name</span>
          <input
            name="name"
            value={form.name}
            onChange={(event) => setField('name', event.target.value)}
            required
          />
        </label>

        <label className={styles.field}>
          <span>Origin station</span>
          <input
            name="origin"
            value={form.originInput}
            onChange={(event) => onOriginChange(event.target.value)}
            onFocus={() => setActiveField('origin')}
            onBlur={() => setTimeout(() => setActiveField((current) => (current === 'origin' ? null : current)), 120)}
            placeholder="Type station name"
            autoComplete="off"
            required
          />
          {activeField === 'origin' && originSuggestions.length > 0 && (
            <div className={styles.suggestionList} role="listbox" aria-label="Origin station suggestions">
              {originSuggestions.map((station) => (
                <button
                  key={station.id}
                  type="button"
                  className={styles.suggestionItem}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pickOrigin(station)}
                >
                  {station.name}
                </button>
              ))}
            </div>
          )}
        </label>

        <label className={styles.field}>
          <span>Destination station</span>
          <input
            name="destination"
            value={form.destinationInput}
            onChange={(event) => onDestinationChange(event.target.value)}
            onFocus={() => setActiveField('destination')}
            onBlur={() => setTimeout(() => setActiveField((current) => (current === 'destination' ? null : current)), 120)}
            placeholder="Type station name"
            autoComplete="off"
            required
          />
          {activeField === 'destination' && destinationSuggestions.length > 0 && (
            <div className={styles.suggestionList} role="listbox" aria-label="Destination station suggestions">
              {destinationSuggestions.map((station) => (
                <button
                  key={station.id}
                  type="button"
                  className={styles.suggestionItem}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pickDestination(station)}
                >
                  {station.name}
                </button>
              ))}
            </div>
          )}
        </label>

        <div className={styles.rowTwo}>
          <label className={styles.field}>
            <span>Date</span>
            <input
              name="date"
              type="date"
              value={form.date}
              onChange={(event) => setField('date', event.target.value)}
              required
            />
          </label>

          <label className={styles.field}>
            <span>Time</span>
            <input
              name="time"
              type="time"
              value={form.time}
              onChange={(event) => setField('time', event.target.value)}
              required
            />
          </label>
        </div>

        <div className={styles.rowTwo}>
          <label className={styles.field}>
            <span>Time mode</span>
            <select
              name="timeMode"
              value={form.timeMode}
              onChange={(event) => setField('timeMode', event.target.value)}
            >
              <option value="depart">Depart at</option>
              <option value="arrive">Arrive by</option>
            </select>
          </label>

          <label className={styles.field}>
            <span>Buffer (min)</span>
            <input
              name="bufferMinutes"
              type="number"
              min="0"
              max="90"
              value={form.bufferMinutes}
              onChange={(event) => setField('bufferMinutes', Number(event.target.value))}
            />
          </label>
        </div>

        {validationError && <p className={styles.error}>{validationError}</p>}

        <button type="submit" className={styles.saveBtn} disabled={!canSearch || routesState.loading}>
          {routesState.loading ? 'Finding routes...' : 'Find routes'}
        </button>
      </form>

      {routesState.error && (
        <p className={styles.error}>{routesState.error}</p>
      )}

      {routesState.partialSearch && (
        <p className={styles.note}>Showing best available options from a partial search.</p>
      )}

      {!routesState.loading && !routesState.error && routesState.options.length === 0 && routesState.emptyReason && (
        <p className={styles.note}>{optionReason(routesState.emptyReason)}</p>
      )}

      {routesState.options.length > 0 && (
        <div className={styles.optionList}>
          <div className={styles.optionTitle}>Route options</div>
          {routesState.options.map((option) => (
            <article key={option.id} className={styles.optionCard}>
              <div className={styles.optionRow}>
                <span className={styles.optionTimes}>
                  {toClock(option.departureTime)} → {toClock(option.arrivalTime)}
                </span>
                <span className={styles.optionMeta}>
                  {option.durationMinutes}m · {option.transferCount} transfer{option.transferCount === 1 ? '' : 's'} · walk {Math.round(option.walkMinutes)}m
                </span>
              </div>

              <div className={styles.optionRow}>
                <span
                  className={styles.optionRisk}
                  style={{ color: riskColour(option.riskScore) }}
                >
                  {riskLabel(option.riskScore)} ({option.riskScore})
                </span>
                <span className={styles.optionMeta}>Score {option.score}</span>
              </div>

              <div className={styles.optionAdvice}>{option.recommendation?.title || 'Monitor conditions'}</div>
              <button
                type="button"
                className={styles.useBtn}
                onClick={() => useOption(option)}
              >
                Use this option
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
