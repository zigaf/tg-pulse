import { randomBytes } from 'node:crypto';
import { AdProvider } from '@tgpulse/db';
import { safeFetch } from '../net-guard';
import {
  asRecord,
  optionalString,
  partitionByClickId,
  PLATFORM_TIMEOUT_MS,
  requiredString,
  safeJson,
  truncate,
  unixSeconds,
} from './parse';
import type { AdAdapter, ConversionRow, SendResult, TestResult } from './types';

/**
 * Yandex Metrica offline conversions. A CSV keyed by `yclid` is uploaded to the
 * counter; Direct then optimises on the matching goal. Processing takes up to
 * two hours on Yandex's side, so the worker runs on a slow cadence.
 */

const METRIKA_BASE = 'https://api-metrika.yandex.net/management/v1/counter';
export const YANDEX_BATCH_SIZE = 5000;
const CSV_FILENAME = 'conversions.csv';

export interface YandexConfig {
  counterId: string;
  /** Exact Metrica goal name — case sensitive, as the API docs require. */
  goalName: string;
  price?: string;
  currency?: string;
}

interface YandexCreds {
  oauthToken: string;
}

export function parseYandexConfig(config: unknown): YandexConfig {
  const record = asRecord(config, 'Yandex config');
  const counterId = requiredString(record, 'counterId', 'Yandex config');
  if (!/^\d+$/.test(counterId)) {
    throw new Error('Yandex config: "counterId" must be numeric');
  }
  const price = optionalString(record, 'price');
  const currency = optionalString(record, 'currency');
  // Metrica rejects a price without the currency it is denominated in.
  if (price && !currency) {
    throw new Error('Yandex config: "currency" is required when "price" is set');
  }
  return {
    counterId,
    goalName: requiredString(record, 'goalName', 'Yandex config'),
    ...(price ? { price } : {}),
    ...(currency ? { currency } : {}),
  };
}

function parseYandexCreds(creds: unknown): YandexCreds {
  const record = asRecord(creds, 'Yandex credentials');
  return { oauthToken: requiredString(record, 'oauthToken', 'Yandex credentials') };
}

/** RFC 4180 escaping: goal names may legitimately contain commas or quotes. */
function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * `Yclid,Target,DateTime[,Price,Currency]` — the optional columns are omitted
 * entirely when no price is configured, which is what Metrica expects.
 */
export function buildYandexCsv(rows: ConversionRow[], config: YandexConfig): string {
  const withPrice = Boolean(config.price && config.currency);
  const header = ['Yclid', 'Target', 'DateTime', ...(withPrice ? ['Price', 'Currency'] : [])];

  const lines = [header.join(',')];
  for (const row of rows) {
    const yclid = row.payload?.yclid;
    if (!yclid) continue; // defensive: the caller filters these out first
    const cells = [
      csvCell(yclid),
      csvCell(config.goalName),
      String(unixSeconds(row.occurredAt)),
      ...(withPrice ? [csvCell(config.price as string), csvCell(config.currency as string)] : []),
    ];
    lines.push(cells.join(','));
  }

  return `${lines.join('\n')}\n`;
}

/** multipart/form-data body with a single `file` part, built deterministically. */
export function buildMultipartBody(boundary: string, csv: string): string {
  return [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${CSV_FILENAME}"`,
    'Content-Type: text/csv',
    '',
    csv,
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

function errorText(status: number, json: Record<string, unknown> | null, body: string): string {
  const errors = json?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const parts = errors.map((e) => {
      const item = typeof e === 'object' && e !== null ? (e as Record<string, unknown>) : {};
      const type = typeof item.error_type === 'string' ? item.error_type : 'error';
      const message = typeof item.message === 'string' ? item.message : JSON.stringify(e);
      return `${type}: ${message}`;
    });
    return truncate(`HTTP ${status}: ${parts.join('; ')}`);
  }
  if (typeof json?.message === 'string') {
    return truncate(`HTTP ${status}: ${json.message}`);
  }
  return truncate(`HTTP ${status}${body ? `: ${body}` : ''}`);
}

async function fetchCounterGoals(
  counterId: string,
  oauthToken: string,
): Promise<{ status: number; json: Record<string, unknown> | null; body: string }> {
  const res = await safeFetch(`${METRIKA_BASE}/${counterId}?field=goals`, PLATFORM_TIMEOUT_MS, {
    headers: { authorization: `OAuth ${oauthToken}` },
    readBody: true,
  });
  return { status: res.status, json: safeJson(res.body), body: res.body };
}

function goalNames(json: Record<string, unknown> | null): string[] {
  const counter = json?.counter;
  if (typeof counter !== 'object' || counter === null) return [];
  const goals = (counter as Record<string, unknown>).goals;
  if (!Array.isArray(goals)) return [];
  return goals
    .map((g) => (typeof g === 'object' && g !== null ? (g as Record<string, unknown>).name : null))
    .filter((name): name is string => typeof name === 'string');
}

export const yandexAdapter: AdAdapter = {
  provider: AdProvider.YANDEX_METRIKA,
  batchSize: YANDEX_BATCH_SIZE,

  validateConfig(config: unknown): void {
    parseYandexConfig(config);
  },

  /**
   * Reads the counter and its goals: verifies the OAuth token, the counter id
   * and — the usual failure — that the goal name matches exactly.
   */
  async test(creds: unknown, config: unknown): Promise<TestResult> {
    try {
      const { counterId, goalName } = parseYandexConfig(config);
      const { oauthToken } = parseYandexCreds(creds);

      const { status, json, body } = await fetchCounterGoals(counterId, oauthToken);
      if (status >= 400 || !json) {
        return { ok: false, detail: errorText(status, json, body) };
      }

      const names = goalNames(json);
      if (!names.includes(goalName)) {
        const known = names.length > 0 ? names.join(', ') : 'none';
        return {
          ok: false,
          detail: truncate(`Goal "${goalName}" not found on counter ${counterId}. Goals: ${known}`),
        };
      }
      return { ok: true, detail: `Counter ${counterId} reachable, goal "${goalName}" found` };
    } catch (e) {
      return { ok: false, detail: truncate(e instanceof Error ? e.message : String(e)) };
    }
  },

  /** The upload is all-or-nothing: Metrica validates and accepts the whole file. */
  async send(batch: ConversionRow[], creds: unknown, config: unknown): Promise<SendResult> {
    const cfg = parseYandexConfig(config);
    const { oauthToken } = parseYandexCreds(creds);

    const { usable, failed } = partitionByClickId(
      batch,
      (row) => row.payload?.yclid,
      'no yclid captured',
    );
    if (usable.length === 0) return { sent: [], failed };

    const rows = usable.map(({ row }) => row);
    const boundary = `----tgpulse${randomBytes(16).toString('hex')}`;
    const body = buildMultipartBody(boundary, buildYandexCsv(rows, cfg));

    const res = await safeFetch(
      `${METRIKA_BASE}/${cfg.counterId}/offline_conversions/upload?client_id_type=YCLID`,
      PLATFORM_TIMEOUT_MS,
      {
        method: 'POST',
        headers: {
          authorization: `OAuth ${oauthToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
        readBody: true,
      },
    );

    if (res.status >= 400) {
      const detail = errorText(res.status, safeJson(res.body), res.body);
      return { sent: [], failed: [...failed, ...rows.map((r) => ({ eventKey: r.eventKey, error: detail }))] };
    }

    return { sent: rows.map((r) => r.eventKey), failed };
  },
};
