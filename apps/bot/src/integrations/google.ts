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
} from './parse';
import type { AdAdapter, ConversionRow, SendResult, TestResult } from './types';

/**
 * Google — Data Manager API, `POST /v1/events:ingest`.
 *
 * Deliberately NOT the Google Ads API `UploadClickConversions`: since
 * 2026-06-15 that call fails with CUSTOMER_NOT_ALLOWLISTED_FOR_THIS_FEATURE
 * for every developer token that was not already uploading conversions, which
 * is exactly what a new TGPulse user would bring. The Data Manager API is
 * Google's designated replacement, needs no developer token at all, and only
 * wants an OAuth client with the `datamanager` scope (verified against the
 * Data Manager API reference, checked 2026-08-21).
 *
 * The upload is asynchronous on Google's side: a 200 returns a `requestId`
 * and per-field warnings, hard row failures surface later via requestStatus.
 * So the batch is accounted as a unit, like the Yandex CSV upload.
 */

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const INGEST_URL = 'https://datamanager.googleapis.com/v1/events:ingest';
/** Documented cap for one `events` array. */
export const GOOGLE_BATCH_SIZE = 2000;

export interface GoogleConfig {
  /** Google Ads customer id that owns the conversion action, digits only. */
  operatingAccountId: string;
  /** Import ("Upload clicks") conversion action id; travels as `productDestinationId`. */
  conversionActionId: string;
  /** Manager (MCC) account the OAuth user signs in through, when access is indirect. */
  loginAccountId?: string;
}

interface GoogleCreds {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/** Customer ids are pasted as `123-456-7890` as often as not. */
function stripDashes(value: string): string {
  return value.replace(/-/g, '');
}

function accountId(record: Record<string, unknown>, key: string, label: string): string {
  const value = stripDashes(requiredString(record, key, label));
  if (!/^\d{1,15}$/.test(value)) {
    throw new Error(`${label}: "${key}" must be digits only`);
  }
  return value;
}

export function parseGoogleConfig(config: unknown): GoogleConfig {
  const record = asRecord(config, 'Google config');
  const loginRaw = optionalString(record, 'loginAccountId');
  const loginAccountId = loginRaw ? stripDashes(loginRaw) : undefined;
  if (loginAccountId && !/^\d{1,15}$/.test(loginAccountId)) {
    throw new Error('Google config: "loginAccountId" must be digits only');
  }
  return {
    operatingAccountId: accountId(record, 'operatingAccountId', 'Google config'),
    conversionActionId: accountId(record, 'conversionActionId', 'Google config'),
    ...(loginAccountId ? { loginAccountId } : {}),
  };
}

function parseGoogleCreds(creds: unknown): GoogleCreds {
  const record = asRecord(creds, 'Google credentials');
  return {
    clientId: requiredString(record, 'clientId', 'Google credentials'),
    clientSecret: requiredString(record, 'clientSecret', 'Google credentials'),
    refreshToken: requiredString(record, 'refreshToken', 'Google credentials'),
  };
}

/** `{ error: { message, status } }` for the API, `{ error, error_description }` for OAuth. */
function errorText(status: number, json: Record<string, unknown> | null, body: string): string {
  const apiError = json?.error;
  if (typeof apiError === 'object' && apiError !== null) {
    const record = apiError as Record<string, unknown>;
    const message = typeof record.message === 'string' ? record.message : '';
    const code = typeof record.status === 'string' ? record.status : '';
    if (message) return truncate(code ? `${code}: ${message}` : message);
  }
  if (typeof apiError === 'string') {
    const description = typeof json?.error_description === 'string' ? json.error_description : '';
    return truncate(description ? `${apiError}: ${description}` : apiError);
  }
  return truncate(`HTTP ${status}${body ? `: ${body}` : ''}`);
}

/** Exchange the long-lived refresh token for a bearer token; throws with Google's wording. */
async function fetchAccessToken(creds: GoogleCreds): Promise<string> {
  const res = await safeFetch(OAUTH_TOKEN_URL, PLATFORM_TIMEOUT_MS, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
    readBody: true,
  });
  const json = safeJson(res.body);
  const token = typeof json?.access_token === 'string' ? json.access_token : '';
  if (res.status >= 400 || !token) {
    throw new Error(`token refresh failed — ${errorText(res.status, json, res.body)}`);
  }
  return token;
}

export interface GoogleEvent {
  adIdentifiers: { gclid: string };
  eventTimestamp: string;
  /** Google's dedup key; a retried batch never double-counts. */
  transactionId: string;
  eventSource: 'WEB';
}

export function buildGoogleEvent(row: ConversionRow): GoogleEvent {
  const gclid = row.payload?.gclid;
  if (!gclid) {
    throw new Error('no gclid captured');
  }
  return {
    adIdentifiers: { gclid },
    eventTimestamp: row.occurredAt.toISOString(),
    transactionId: row.eventKey,
    eventSource: 'WEB',
  };
}

/**
 * Request-level consent is declared granted: the click carried a gclid, which
 * only exists when the visitor accepted ads cookies, and without the field
 * Google silently discards every EEA event.
 */
export function buildIngestBody(
  config: GoogleConfig,
  events: GoogleEvent[],
  validateOnly: boolean,
): Record<string, unknown> {
  return {
    destinations: [
      {
        operatingAccount: { accountType: 'GOOGLE_ADS', accountId: config.operatingAccountId },
        ...(config.loginAccountId
          ? { loginAccount: { accountType: 'GOOGLE_ADS', accountId: config.loginAccountId } }
          : {}),
        productDestinationId: config.conversionActionId,
      },
    ],
    events,
    consent: { adUserData: 'CONSENT_GRANTED', adPersonalization: 'CONSENT_GRANTED' },
    ...(validateOnly ? { validateOnly: true } : {}),
  };
}

function postIngest(token: string, body: Record<string, unknown>) {
  return safeFetch(INGEST_URL, PLATFORM_TIMEOUT_MS, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    readBody: true,
  });
}

/** Synthetic probe row; `validateOnly` means Google checks it but never records it. */
function testEvent(config: GoogleConfig): GoogleEvent {
  return {
    adIdentifiers: { gclid: 'tgpulse-connection-test' },
    eventTimestamp: new Date().toISOString(),
    transactionId: `tgpulse-test-${config.conversionActionId}`,
    eventSource: 'WEB',
  };
}

export const googleAdapter: AdAdapter = {
  provider: AdProvider.GOOGLE_ADS,
  batchSize: GOOGLE_BATCH_SIZE,

  validateConfig(config: unknown): void {
    parseGoogleConfig(config);
  },

  /**
   * Two real calls, zero recorded data: the token refresh proves the OAuth
   * client and refresh token, then a `validateOnly` ingest proves the account,
   * the conversion action and the permission to upload into it.
   */
  async test(creds: unknown, config: unknown): Promise<TestResult> {
    try {
      const cfg = parseGoogleConfig(config);
      const token = await fetchAccessToken(parseGoogleCreds(creds));

      const res = await postIngest(token, buildIngestBody(cfg, [testEvent(cfg)], true));
      if (res.status >= 400) {
        return { ok: false, detail: errorText(res.status, safeJson(res.body), res.body) };
      }
      return {
        ok: true,
        detail: `Conversion action ${cfg.conversionActionId} on account ${cfg.operatingAccountId} accepted a validate-only upload`,
      };
    } catch (e) {
      return { ok: false, detail: truncate(e instanceof Error ? e.message : String(e)) };
    }
  },

  /** Accounted as a unit: a 200 means Google accepted the batch for processing. */
  async send(batch: ConversionRow[], creds: unknown, config: unknown): Promise<SendResult> {
    const cfg = parseGoogleConfig(config);

    const { usable, failed } = partitionByClickId(
      batch,
      (row) => row.payload?.gclid,
      'no gclid captured',
    );
    if (usable.length === 0) return { sent: [], failed };

    const rows = usable.map(({ row }) => row);
    let token: string;
    try {
      token = await fetchAccessToken(parseGoogleCreds(creds));
    } catch (e) {
      // Retryable: an expired Google session should not need six attempts to surface.
      const error = truncate(e instanceof Error ? e.message : String(e));
      return { sent: [], failed: [...failed, ...rows.map((r) => ({ eventKey: r.eventKey, error }))] };
    }

    const events = rows.map((row) => buildGoogleEvent(row));
    const res = await postIngest(token, buildIngestBody(cfg, events, false));
    const json = safeJson(res.body);

    if (res.status >= 400) {
      const detail = errorText(res.status, json, res.body);
      return { sent: [], failed: [...failed, ...rows.map((r) => ({ eventKey: r.eventKey, error: detail }))] };
    }

    const warnings = Array.isArray(json?.fieldWarnings) ? json.fieldWarnings.length : 0;
    if (warnings > 0) {
      console.warn(`[conversions] google accepted the batch with ${warnings} field warning(s)`);
    }
    return { sent: rows.map((row) => row.eventKey), failed };
  },
};
