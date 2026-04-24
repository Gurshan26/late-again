import { CircleMarker, Tooltip } from 'react-leaflet';

export default function StationMarker({ position, color, name, selected, onClick }) {
  return (
    <CircleMarker
      center={position}
      radius={selected ? 6 : 3}
      pathOptions={{
        color,
        fillColor: color,
        fillOpacity: 0.9,
        weight: 1,
        className: selected ? 'station-pulse' : '',
      }}
      eventHandlers={{ click: onClick }}
    >
      <Tooltip>{name}</Tooltip>
    </CircleMarker>
  );
}
