export function formatHour(hour) {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function formatTimestamp(isoString) {
  if (!isoString) return '--:--';
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Australia/Melbourne',
  });
}
