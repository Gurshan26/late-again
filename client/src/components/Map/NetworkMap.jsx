import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import lines from '../../utils/lineMetadata';
import LineLayer from './LineLayer';
import styles from './NetworkMap.module.css';

const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '© OpenStreetMap contributors © CARTO';
const MEL_CENTER = [-37.8136, 144.9631];

export default function NetworkMap({ selectedLine, onSelectLine }) {
  return (
    <div className={styles.wrapper}>
      <MapContainer
        center={MEL_CENTER}
        zoom={11}
        className={styles.map}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url={DARK_TILES} attribution={TILE_ATTR} />

        {lines.map((line) => (
          <LineLayer
            key={line.id}
            line={line}
            isSelected={selectedLine === line.id}
            onClick={() => onSelectLine(line.id === selectedLine ? null : line.id)}
          />
        ))}
      </MapContainer>

      <div className={styles.legend}>
        <span className={styles.legendItem} style={{ color: 'var(--accent-safe)' }}>
          ● Low
        </span>
        <span className={styles.legendItem} style={{ color: 'var(--accent-warning)' }}>
          ● Moderate
        </span>
        <span className={styles.legendItem} style={{ color: 'var(--accent-alert)' }}>
          ● High
        </span>
      </div>
    </div>
  );
}
