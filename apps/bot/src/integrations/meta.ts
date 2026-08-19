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
import type { AdAdapter, ConversionRow, FailedConversion, SendResult, TestResult } from './types';

/**
 * Meta Conversions API. The Offline Conversions API was retired in 2025, so CRM
 * events go through CAPI with `action_source: 'website'` and a stable `event_id`
 * for deduplication.
 */

const GRAPH_BASE = 'https://graph.facebook.com';
const API_VERSION = 'v21.0';
export const META_BATCH_SIZE = 500;
const DEFAULT_EVENT_NAME = 'Subscribe';
/** Meta reports per-event problems as `data[<index>]: ...` inside `messages`. */
const INDEXED_MESSAGE = /data\[(\d+)\]/;

export interface MetaConfig {
  pixelId: string;
  eventName: string;
  /** Routes the batch to Events Manager "Test events" instead of live data. */
  testEventCode?: string;
}

interface MetaCreds {
  accessToken: string;
}

export interface MetaEvent {
  event_name: string;
  event_time: number;
  event_id: string;
  action_source: 'website';
  user_data: { fbc: string; fbp?: string };
}

export function parseMetaConfig(config: unknown): MetaConfig {
  const record = asRecord(config, 'Meta config');
  return {
    pixelId: requiredString(record, 'pixelId', 'Meta config'),
    eventName: optionalString(record, 'eventName') ?? DEFAULT_EVENT_NAME,
    testEventCode: optionalString(record, 'testEventCode'),
  };
}

function parseMetaCreds(creds: unknown): MetaCreds {
  const record = asRecord(creds, 'Meta credentials');
  return { accessToken: requiredString(record, 'accessToken', 'Meta credentials') };
}

/**
 * Build one CAPI event. `fbc` is sent in plain text on purpose: it is a click id,
 * not PII, and hashing it breaks matching entirely.
 */
export function buildMetaEvent(row: ConversionRow, eventName: string): MetaEvent {
  const fbclid = row.payload?.fbclid;
  if (!fbclid) {
    throw new Error('no fbclid captured');
  }
  // fb.<subdomain-index>.<click-timestamp-ms>.<fbclid>; falls back to the join
  // time when the click row carried no timestamp.
  const clickTsMs = row.payload.clickTsMs ?? row.occurredAt.getTime();
  const fbp = (row.payload as { fbp?: string }).fbp;

  return {
    event_name: eventName,
    event_time: unixSeconds(row.occurredAt),
    event_id: row.eventKey,
    action_source: 'website',
    user_data: { fbc: `fb.1.${clickTsMs}.${fbclid}`, ...(fbp ? { fbp } : {}) },
  };
}

function errorText(status: number, json: Record<string, unknown> | null, body: string): string {
  const error = json?.error;
  if (typeof error === 'object' && error !== null) {
    const e = error as Record<string, unknown>;
    const message =
      (typeof e.error_user_msg === 'string' && e.error_user_msg) ||
      (typeof e.message === 'string' && e.message) ||
      '';
    if (message) return truncate(`HTTP ${status}: ${message}`);
  }
  return truncate(`HTTP ${status}${body ? `: ${body}` : ''}`);
}

/** Meta `messages` entries are strings or objects; normalise to readable text. */
function messageTexts(json: Record<string, unknown> | null): string[] {
  const messages = json?.messages;
  if (!Array.isArray(messages)) return [];
  return messages
    .map((m) => (typeof m === 'string' ? m : JSON.stringify(m)))
    .filter((m) => m.length > 0);
}

export const metaAdapter: AdAdapter = {
  provider: AdProvider.META_CAPI,
  batchSize: META_BATCH_SIZE,

  validateConfig(config: unknown): void {
    parseMetaConfig(config);
  },

  /**
   * Reads the pixel (dataset) node: verifies the token, its permissions and the
   * pixel id without writing any event. The token travels in the Authorization
   * header, never in the URL, so it cannot leak through logs.
   */
  async test(creds: unknown, config: unknown): Promise<TestResult> {
    try {
      const { pixelId } = parseMetaConfig(config);
      const { accessToken } = parseMetaCreds(creds);

      const res = await safeFetch(
        `${GRAPH_BASE}/${API_VERSION}/${pixelId}?fields=name,id`,
        PLATFORM_TIMEOUT_MS,
        { headers: { authorization: `Bearer ${accessToken}` }, readBody: true },
      );
      const json = safeJson(res.body);
      if (res.status >= 400 || !json) {
        return { ok: false, detail: errorText(res.status, json, res.body) };
      }
      const name = typeof json.name === 'string' ? json.name : pixelId;
      return { ok: true, detail: `Connected to pixel "${name}"` };
    } catch (e) {
      return { ok: false, detail: truncate(e instanceof Error ? e.message : String(e)) };
    }
  },

  async send(batch: ConversionRow[], creds: unknown, config: unknown): Promise<SendResult> {
    const { pixelId, eventName, testEventCode } = parseMetaConfig(config);
    const { accessToken } = parseMetaCreds(creds);

    // Without an fbclid Meta has nothing to match on, so retrying is pointless.
    const { usable, failed } = partitionByClickId(
      batch,
      (row) => row.payload?.fbclid,
      'no fbclid captured',
    );
    if (usable.length === 0) return { sent: [], failed };

    const events = usable.map(({ row }) => buildMetaEvent(row, eventName));
    const res = await safeFetch(
      `${GRAPH_BASE}/${API_VERSION}/${pixelId}/events`,
      PLATFORM_TIMEOUT_MS,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          data: events,
          access_token: accessToken,
          ...(testEventCode ? { test_event_code: testEventCode } : {}),
        }),
        readBody: true,
      },
    );

    const json = safeJson(res.body);
    if (res.status >= 400 || typeof json?.events_received !== 'number') {
      const detail = errorText(res.status, json, res.body);
      return {
        sent: [],
        failed: [...failed, ...usable.map(({ row }) => ({ eventKey: row.eventKey, error: detail }))],
      };
    }

    return classifyResponse(usable, failed, json);
  },
};

/**
 * Meta accepts a batch partially: `events_received` counts the good ones and
 * `messages` explains the rest, sometimes with a `data[<index>]` reference.
 */
function classifyResponse(
  usable: { row: ConversionRow }[],
  failed: FailedConversion[],
  json: Record<string, unknown>,
): SendResult {
  const received = json.events_received as number;
  const perEvent = new Map<number, string>();
  const generic: string[] = [];

  for (const message of messageTexts(json)) {
    const match = message.match(INDEXED_MESSAGE);
    const index = match ? Number(match[1]) : -1;
    if (index >= 0 && index < usable.length) {
      perEvent.set(index, message);
    } else {
      generic.push(message);
    }
  }

  const sent: string[] = [];
  const allFailed = [...failed];
  const genericText = generic.length > 0 ? truncate(generic.join('; ')) : null;
  // Unattributed shortfall: the API took fewer events than we sent and did not
  // say which ones, so the remainder is retried (event_id makes that safe).
  const shortfall = received < usable.length - perEvent.size;

  usable.forEach(({ row }, index) => {
    const indexed = perEvent.get(index);
    if (indexed) {
      allFailed.push({ eventKey: row.eventKey, error: truncate(indexed) });
      return;
    }
    if (shortfall) {
      allFailed.push({
        eventKey: row.eventKey,
        error: genericText ?? `only ${received}/${usable.length} events accepted`,
      });
      return;
    }
    sent.push(row.eventKey);
  });

  if (genericText && !shortfall) {
    console.warn(`[conversions] meta warning: ${genericText}`);
  }

  return { sent, failed: allFailed };
}
