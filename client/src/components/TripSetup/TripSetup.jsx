import { useEffect, useState } from 'react';
import lines from '../../utils/lineMetadata';
import styles from './TripSetup.module.css';

const emptyForm = {
  name: 'Morning commute',
  origin: '',
  destination: '',
  lineId: 'frankston',
  direction: 'citybound',
  usualDeparture: '08:10',
  preferredArrival: '09:00',
  bufferMinutes: 12,
};

export default function TripSetup({
  profile,
  saveProfile,
  clearProfile,
  expanded,
  onToggle,
}) {
  const [form, setForm] = useState(profile || emptyForm);

  useEffect(() => {
    setForm(profile || emptyForm);
  }, [profile]);

  function onChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === 'bufferMinutes' ? Number(value) : value,
    }));
  }

  function onSubmit(event) {
    event.preventDefault();
    saveProfile({
      ...profile,
      ...form,
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
          {profile.name}: {profile.origin || 'Origin'} → {profile.destination || 'Destination'}
        </p>
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

      <form className={styles.form} onSubmit={onSubmit}>
        <label className={styles.field}>
          <span>Trip name</span>
          <input name="name" value={form.name} onChange={onChange} required />
        </label>

        <label className={styles.field}>
          <span>Origin station</span>
          <input name="origin" value={form.origin} onChange={onChange} placeholder="Frankston" required />
        </label>

        <label className={styles.field}>
          <span>Destination station</span>
          <input name="destination" value={form.destination} onChange={onChange} placeholder="Flinders Street" required />
        </label>

        <label className={styles.field}>
          <span>Line</span>
          <select name="lineId" value={form.lineId} onChange={onChange}>
            {lines.map((line) => (
              <option key={line.id} value={line.id}>{line.name}</option>
            ))}
          </select>
        </label>

        <div className={styles.rowTwo}>
          <label className={styles.field}>
            <span>Direction</span>
            <select name="direction" value={form.direction} onChange={onChange}>
              <option value="citybound">Citybound</option>
              <option value="outbound">Outbound</option>
            </select>
          </label>

          <label className={styles.field}>
            <span>Buffer (min)</span>
            <input name="bufferMinutes" type="number" min="0" max="90" value={form.bufferMinutes} onChange={onChange} />
          </label>
        </div>

        <div className={styles.rowTwo}>
          <label className={styles.field}>
            <span>Usual departure</span>
            <input name="usualDeparture" type="time" value={form.usualDeparture} onChange={onChange} />
          </label>

          <label className={styles.field}>
            <span>Preferred arrival</span>
            <input name="preferredArrival" type="time" value={form.preferredArrival} onChange={onChange} />
          </label>
        </div>

        <button type="submit" className={styles.saveBtn}>Save trip</button>
      </form>
    </section>
  );
}
