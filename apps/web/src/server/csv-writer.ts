/**
 * RFC 4180 CSV writer (the reader lives in `csv.ts`).
 *
 * Beyond quoting, values that a spreadsheet would treat as a formula are prefixed with a
 * single quote: labels and usernames are attacker-controlled and a raw `=HYPERLINK(...)`
 * in an exported file is a real attack on whoever opens it.
 */

export type CsvValue = string | number | boolean | bigint | Date | null | undefined;

const NEEDS_QUOTES = /["\n\r,;\t]/;
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

function stringify(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  // BigInt ids (tgUserId, tgChatId) would throw on JSON paths and lose precision as numbers.
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  return value;
}

export function escapeCsvValue(value: CsvValue): string {
  const raw = stringify(value);
  // Only strings can carry a formula; numbers are emitted by us and stay untouched.
  const safe =
    typeof value === 'string' && FORMULA_PREFIXES.some((prefix) => raw.startsWith(prefix))
      ? `'${raw}`
      : raw;

  if (!NEEDS_QUOTES.test(safe)) return safe;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsvRow(values: readonly CsvValue[]): string {
  return values.map(escapeCsvValue).join(',');
}

/** Serialize a header row plus data rows into CRLF-terminated CSV text. */
export function buildCsv(headers: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  return [toCsvRow(headers), ...rows.map(toCsvRow)].join('\r\n') + '\r\n';
}

/** Filesystem-safe slug for a Content-Disposition filename. */
export function filenameSlug(raw: string, fallback: string): string {
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || fallback;
}
