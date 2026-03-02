/**
 * Parse duration string to decimal hours.
 * "1h 30m" -> 1.5, "2d" -> 16, "45m" -> 0.75.
 * Returns null when format is invalid.
 */
export function parseDurationToHours(input) {
  if (!input?.trim()) return null;

  const str = input.trim().toLowerCase();
  const d = str.match(/(\d+(?:\.\d+)?)\s*d/)?.[1] ?? 0;
  const h = str.match(/(\d+(?:\.\d+)?)\s*h/)?.[1] ?? 0;
  const m = str.match(/(\d+(?:\.\d+)?)\s*m/)?.[1] ?? 0;

  if (!+d && !+h && !+m) return null;
  return Number.parseFloat(d) * 8 + Number.parseFloat(h) + Number.parseFloat(m) / 60;
}

export function formatDuration(hours) {
  if (!hours) return '0h';

  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);

  if (m === 0) return `${h}h`;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}
