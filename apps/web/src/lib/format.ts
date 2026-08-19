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

/* ---------- money ---------- */

/**
 * Intl formatters are expensive to construct and the dashboard formats hundreds
 * of cells per render, so keep one instance per (currency, notation) pair.
 * Currency codes come from the API and are validated there, but an unknown code
 * still throws in Intl, so fall back to a plain number format.
 */
const moneyFormats = new Map<string, Intl.NumberFormat>();

function moneyFormat(currency: string, isCompact: boolean): Intl.NumberFormat {
  const cacheKey = `${currency}:${isCompact ? 'compact' : 'standard'}`;
  const cached = moneyFormats.get(cacheKey);
  if (cached) return cached;

  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    notation: isCompact ? 'compact' : 'standard',
    maximumFractionDigits: isCompact ? 1 : 2,
  };

  let format: Intl.NumberFormat;
  try {
    format = new Intl.NumberFormat('en-US', options);
  } catch {
    format = new Intl.NumberFormat('en-US', { ...options, style: 'decimal', currency: undefined });
  }
  moneyFormats.set(cacheKey, format);
  return format;
}

/** 1234.5, "USD" → "$1,234.50" */
export function formatMoney(value: number, currency: string): string {
  return moneyFormat(currency, false).format(value);
}

/** 12400, "USD" → "$12.4K" (chart axes and tight cells) */
export function formatCompactMoney(value: number, currency: string): string {
  return moneyFormat(currency, true).format(value);
}

/** ISO 4217 code Telegram uses for Stars. */
export const STARS_CURRENCY = 'XTR';

/** Payments are in Stars (XTR), everything else falls back to a real currency format. */
export function formatPaymentAmount(value: number, currency: string): string {
  const code = currency.toUpperCase();
  if (code === STARS_CURRENCY) return `${formatNumber(value)} Stars`;
  return formatMoney(value / 100, code);
}

export const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME || 'tgpulse_app_bot';

/** Public base of the go/pixel service (bot app); used to build client-side snippets. */
export const GO_BASE =
  process.env.NEXT_PUBLIC_GO_BASE_URL?.replace(/\/+$/, '') || 'https://bot-production-04da.up.railway.app';

/** Landing pixel snippet for a tracked link slug. */
export function pixelSnippet(slug: string): string {
  return `<script async src="${GO_BASE}/pixel.js" data-tgp="${slug}"></script>`;
}
