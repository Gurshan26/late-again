import { Polyline, Tooltip } from 'react-leaflet';
import { useDelayData } from '../../hooks/useDelayData';
import { riskColour } from '../../utils/riskColour';
import StationMarker from './StationMarker';

export default function LineLayer({ line, isSelected, onClick }) {
  const { data } = useDelayData(line.id);
  const risk = data?.currentRisk ?? 0;
  const color = riskColour(risk);

  return (
    <>
      <Polyline
        positions={line.coordinates}
        pathOptions={{
          color,
          weight: isSelected ? 6 : 3,
          opacity: isSelected ? 1 : 0.7,
          lineCap: 'round',
          lineJoin: 'round',
          className: isSelected ? 'line-pulse' : '',
        }}
        eventHandlers={{ click: onClick }}
      >
        <Tooltip sticky>{`${line.name} — Risk ${risk}`}</Tooltip>
      </Polyline>

      {line.coordinates.map((position, idx) => (
        <StationMarker
          key={`${line.id}-${idx}`}
          position={position}
          color={color}
          name={line.keyStations[idx] || line.name}
          selected={isSelected}
          onClick={onClick}
        />
      ))}
    </>
  );
}
