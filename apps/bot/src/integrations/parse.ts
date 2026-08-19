import type { ConversionRow, FailedConversion } from './types';

/** Boundary-validation helpers shared by adapters. Nothing here logs or throws secrets. */

export const PLATFORM_TIMEOUT_MS = 15_000;
/** Persisted `lastError` columns stay readable in the dashboard. */
export const MAX_ERROR_LENGTH = 500;

export function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function requiredString(
  source: Record<string, unknown>,
  key: string,
  label: string,
): string {
  const value = source[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label}: "${key}" is required`);
  }
  return value.trim();
}

export function optionalString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  return value.trim();
}

/** Parse a platform response body without letting malformed JSON mask the status. */
export function safeJson(body: string): Record<string, unknown> | null {
  if (!body) return null;
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function truncate(text: string): string {
  return text.length > MAX_ERROR_LENGTH ? `${text.slice(0, MAX_ERROR_LENGTH - 1)}…` : text;
}

/** Unix seconds; every supported platform wants seconds, not milliseconds. */
export function unixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/**
 * Split a batch into rows that carry the click id the platform can match and
 * rows that can never be matched — the latter fail permanently, with a reason.
 */
export function partitionByClickId(
  batch: ConversionRow[],
  pick: (row: ConversionRow) => string | undefined,
  missingReason: string,
): { usable: { row: ConversionRow; clickId: string }[]; failed: FailedConversion[] } {
  const usable: { row: ConversionRow; clickId: string }[] = [];
  const failed: FailedConversion[] = [];

  for (const row of batch) {
    const clickId = pick(row);
    if (clickId) {
      usable.push({ row, clickId });
    } else {
      failed.push({ eventKey: row.eventKey, error: missingReason, permanent: true });
    }
  }

  return { usable, failed };
}
