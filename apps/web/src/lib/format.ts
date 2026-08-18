/** Display formatters shared across the dashboard. */

const numberFormat = new Intl.NumberFormat('en-US');

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** Prefix positive values with "+" (used for net change). */
export function formatSigned(value: number): string {
  return value > 0 ? `+${numberFormat.format(value)}` : numberFormat.format(value);
}

/** value is a percent number, e.g. 3.2 → "3.2%" */
export function formatRate(value: number): string {
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${rounded}%`;
}

/** "2026-08-12" or ISO timestamp → "Aug 12" */
export function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** ISO timestamp → "Aug 12, 2026" */
export function formatFullDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME || 'tgpulse_bot';
