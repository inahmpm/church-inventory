const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateOnly(value: string): Date | null {
  const m = DATE_ONLY_RE.exec(value);
  if (!m) return null;
  // Construct in local time so a stored yyyy-mm-dd doesn't shift a day via UTC parsing.
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Formats a yyyy-mm-dd string, timestamp, or Date as "Aug 16, 2026". Returns '—' if empty/invalid. */
export function formatDate(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const d = typeof value === 'string' ? (parseDateOnly(value) ?? new Date(value)) : new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Formats a timestamp (ms) as "Aug 16, 2026, 3:45 PM". Returns '—' if empty/invalid. */
export function formatDateTime(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
