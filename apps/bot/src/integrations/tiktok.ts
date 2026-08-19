import { createHash } from 'node:crypto';
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
 * TikTok Events API 2.0 — `POST /open_api/v1.3/event/track/`.
 *
 * Verified against the TikTok Business API portal docs for Events API 2.0
 * (endpoint version v1.3, checked 2026-08-19). The v1.3 path is the current
 * carrier of the "2.0" event schema: `event_source` + `event_source_id` at the
 * top level and a `data` array of events, which is what replaced the old
 * `pixel_code` + `event`/`context` shape of Events 1.0.
 *
 * Two behaviours drive the code below:
 *  - the HTTP status is 200 even for rejections; the outcome lives in `code`
 *    (0 = accepted) and `message`;
 *  - a batch is validated as a unit, so one bad row rejects the whole call.
 *    `event_id` makes the retry that follows safe (TikTok dedups on it).
 */

const TIKTOK_BASE = 'https://business-api.tiktok.com/open_api/v1.3';
const TRACK_URL = `${TIKTOK_BASE}/event/track/`;
/** Documented cap for a single `data` array. */
export const TIKTOK_BATCH_SIZE = 1000;
const DEFAULT_EVENT_NAME = 'CompleteRegistration';
/**
 * Probe event for `test()`. Deliberately not the configured conversion event:
 * a connection check must never inflate the metric campaigns optimise on.
 */
const TEST_EVENT_NAME = 'ViewContent';
/** TikTok points at the offending row as `data.0...` or `data[0]...`. */
const INDEXED_MESSAGE = /data(?:\[(\d+)\]|\.(\d+))/;

export interface TikTokConfig {
  /** Pixel code from Events Manager; travels as `event_source_id`. */
  pixelCode: string;
  eventName: string;
  /** Routes the batch to the Test Events tab; TikTok then never processes it. */
  testEventCode?: string;
  /** Landing page the ads point at, used for `page.url` when a row has none. */
  pageUrl?: string;
}

interface TikTokCreds {
  accessToken: string;
}

export interface TikTokEvent {
  event: string;
  event_time: number;
  event_id: string;
  user: { ttclid: string };
  page?: { url: string };
}

export function parseTikTokConfig(config: unknown): TikTokConfig {
  const record = asRecord(config, 'TikTok config');
  const pageUrl = optionalString(record, 'pageUrl');
  if (pageUrl && !/^https?:\/\//i.test(pageUrl)) {
    throw new Error('TikTok config: "pageUrl" must be an http(s) URL');
  }
  return {
    pixelCode: requiredString(record, 'pixelCode', 'TikTok config'),
    eventName: optionalString(record, 'eventName') ?? DEFAULT_EVENT_NAME,
    testEventCode: optionalString(record, 'testEventCode'),
    ...(pageUrl ? { pageUrl } : {}),
  };
}

function parseTikTokCreds(creds: unknown): TikTokCreds {
  const record = asRecord(creds, 'TikTok credentials');
  return { accessToken: requiredString(record, 'accessToken', 'TikTok credentials') };
}

/**
 * Build one Events API event. `ttclid` is sent verbatim: TikTok matches on the
 * raw click id, and the SHA-256 rule applies only to PII fields such as
 * `email`, `phone` and `external_id`.
 */
export function buildTikTokEvent(
  row: ConversionRow,
  eventName: string,
  fallbackPageUrl?: string,
): TikTokEvent {
  const ttclid = row.payload?.ttclid;
  if (!ttclid) {
    throw new Error('no ttclid captured');
  }
  const pageUrl = (row.payload as { pageUrl?: string }).pageUrl ?? fallbackPageUrl;

  return {
    event: eventName,
    event_time: unixSeconds(row.occurredAt),
    event_id: row.eventKey,
    user: { ttclid },
    ...(pageUrl ? { page: { url: pageUrl } } : {}),
  };
}

function postEvents(
  accessToken: string,
  config: TikTokConfig,
  events: TikTokEvent[] | Record<string, unknown>[],
) {
  return safeFetch(TRACK_URL, PLATFORM_TIMEOUT_MS, {
    method: 'POST',
    // The token is a header, never a query parameter, so it cannot leak via logs.
    headers: { 'content-type': 'application/json', 'Access-Token': accessToken },
    body: JSON.stringify({
      event_source: 'web',
      event_source_id: config.pixelCode,
      ...(config.testEventCode ? { test_event_code: config.testEventCode } : {}),
      data: events,
    }),
    readBody: true,
  });
}

/** Readable reason from a rejection, whether it arrived as HTTP or as `code`. */
function errorText(status: number, json: Record<string, unknown> | null, body: string): string {
  const message = typeof json?.message === 'string' ? json.message : '';
  const code = typeof json?.code === 'number' ? json.code : null;
  if (message) {
    return truncate(code !== null ? `TikTok error ${code}: ${message}` : `HTTP ${status}: ${message}`);
  }
  return truncate(`HTTP ${status}${body ? `: ${body}` : ''}`);
}

/**
 * Per-row detail, when TikTok bothers to give any. Two shapes are handled: an
 * explicit list under `data.error_details` / `errors`, and the far more common
 * `data.0.user.ttclid ...` reference embedded in `message`.
 */
function perEventErrors(json: Record<string, unknown> | null, size: number): Map<number, string> {
  const found = new Map<number, string>();
  if (!json) return found;

  const data = typeof json.data === 'object' && json.data !== null ? json.data : {};
  const candidates = [(data as Record<string, unknown>).error_details, json.errors];
  for (const list of candidates) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (typeof item !== 'object' || item === null) continue;
      const entry = item as Record<string, unknown>;
      const index = typeof entry.index === 'number' ? entry.index : indexFromText(entry);
      const message = typeof entry.message === 'string' ? entry.message : JSON.stringify(entry);
      if (index !== null && index >= 0 && index < size) found.set(index, truncate(message));
    }
  }

  if (found.size === 0 && typeof json.message === 'string') {
    const index = matchIndex(json.message);
    if (index !== null && index < size) found.set(index, truncate(json.message));
  }
  return found;
}

function indexFromText(entry: Record<string, unknown>): number | null {
  const text = typeof entry.field === 'string' ? entry.field : (entry.message as string) ?? '';
  return typeof text === 'string' ? matchIndex(text) : null;
}

function matchIndex(text: string): number | null {
  const match = text.match(INDEXED_MESSAGE);
  if (!match) return null;
  const raw = match[1] ?? match[2];
  const index = Number(raw);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

/** Synthetic probe row: TikTok wants at least one user identifier, and a hashed constant is the least invasive one. */
function testEvent(config: TikTokConfig): Record<string, unknown> {
  return {
    event: TEST_EVENT_NAME,
    event_time: unixSeconds(new Date()),
    // Stable id: repeated tests dedup into one event instead of accumulating.
    event_id: `tgpulse-test-${config.pixelCode}`,
    user: { external_id: createHash('sha256').update('tgpulse-connection-test').digest('hex') },
    ...(config.pageUrl ? { page: { url: config.pageUrl } } : {}),
  };
}

export const tiktokAdapter: AdAdapter = {
  provider: AdProvider.TIKTOK_EVENTS,
  batchSize: TIKTOK_BATCH_SIZE,

  validateConfig(config: unknown): void {
    parseTikTokConfig(config);
  },

  /**
   * Posts a single probe event to the live endpoint.
   *
   * There is no read-only endpoint that fits: `pixel/list` and
   * `oauth2/advertiser/get` need an advertiser id and app credentials, which a
   * pixel-scoped Events Manager token does not carry — they would fail for a
   * perfectly good token. The write path is the only call that proves the token
   * and the pixel code belong together, so that is what we exercise. With a
   * `testEventCode` the probe lands in Test Events and is never processed;
   * without one it is a single deduped, un-attributable ViewContent.
   */
  async test(creds: unknown, config: unknown): Promise<TestResult> {
    try {
      const cfg = parseTikTokConfig(config);
      const { accessToken } = parseTikTokCreds(creds);

      const res = await postEvents(accessToken, cfg, [testEvent(cfg)]);
      const json = safeJson(res.body);
      if (res.status >= 400 || !json || json.code !== 0) {
        return { ok: false, detail: errorText(res.status, json, res.body) };
      }

      const where = cfg.testEventCode ? 'Test Events' : 'live events';
      return { ok: true, detail: `Pixel ${cfg.pixelCode} accepted a test event (${where})` };
    } catch (e) {
      return { ok: false, detail: truncate(e instanceof Error ? e.message : String(e)) };
    }
  },

  async send(batch: ConversionRow[], creds: unknown, config: unknown): Promise<SendResult> {
    const cfg = parseTikTokConfig(config);
    const { accessToken } = parseTikTokCreds(creds);

    // Without a ttclid TikTok has nothing to match on, so retrying is pointless.
    const { usable, failed } = partitionByClickId(
      batch,
      (row) => row.payload?.ttclid,
      'no ttclid captured',
    );
    if (usable.length === 0) return { sent: [], failed };

    const rows = usable.map(({ row }) => row);
    const events = rows.map((row) => buildTikTokEvent(row, cfg.eventName, cfg.pageUrl));
    const res = await postEvents(accessToken, cfg, events);
    const json = safeJson(res.body);

    if (res.status >= 400 || !json || json.code !== 0) {
      return { sent: [], failed: [...failed, ...rejectAll(rows, json, res.status, res.body)] };
    }

    // code 0 with a message is a warning (e.g. a dropped optional field).
    if (typeof json.message === 'string' && json.message.toUpperCase() !== 'OK') {
      console.warn(`[conversions] tiktok warning: ${truncate(json.message)}`);
    }
    return { sent: rows.map((row) => row.eventKey), failed };
  },
};

/**
 * The batch is validated as a unit, so every row fails; rows TikTok named get
 * their own reason, the rest get the batch-level one.
 */
function rejectAll(
  rows: ConversionRow[],
  json: Record<string, unknown> | null,
  status: number,
  body: string,
): FailedConversion[] {
  const detail = errorText(status, json, body);
  const perEvent = perEventErrors(json, rows.length);
  return rows.map((row, index) => ({
    eventKey: row.eventKey,
    error: perEvent.get(index) ?? detail,
  }));
}
