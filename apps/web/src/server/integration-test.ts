import type { AdIntegration } from '@tgpulse/db';
import { providerLabel, type AdProvider } from '@/lib/ad-providers';
import { safeFetch } from './net-guard';
import {
  decryptCredentials,
  parseGoogleConfig,
  parseMetaConfig,
  parseTikTokConfig,
  parseYandexConfig,
  type GoogleConfig,
  type MetaConfig,
  type StringMap,
  type TikTokConfig,
  type YandexConfig,
} from './integrations';

/**
 * Real verification calls against the ad platforms (docs/AD-INTEGRATIONS.md, "Test").
 *
 * Every request goes through `safeFetch`, so the SSRF guard is re-applied on each redirect hop
 * and the Authorization header is dropped if a redirect leaves the platform's own origin.
 * Whatever the platform says is passed back verbatim: its wording is more useful than ours.
 */

const TEST_TIMEOUT_MS = 10_000;

const META_GRAPH_VERSION = 'v21.0';
const META_GRAPH_ORIGIN = 'https://graph.facebook.com';
const YANDEX_METRIKA_ORIGIN = 'https://api-metrika.yandex.net';
const TIKTOK_ORIGIN = 'https://business-api.tiktok.com';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DATAMANAGER_ORIGIN = 'https://datamanager.googleapis.com';

export interface IntegrationTestResult {
  ok: boolean;
  detail: string;
}

function parseJson(text: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asText(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : '';
}

/** Network failures read the same to the user whichever platform timed out. */
function transportDetail(error: unknown): string {
  const isTimeout =
    error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
  return isTimeout
    ? `No response within ${TEST_TIMEOUT_MS / 1000}s.`
    : 'Could not reach the platform (DNS, TLS or connection refused).';
}

// ---------- Meta ----------

/** Graph API errors always arrive as `{ error: { message, type, code } }`. */
function metaError(body: string, status: number): string {
  const error = asRecord(parseJson(body).error);
  const message = asText(error.message);
  const type = asText(error.type);
  if (!message) return `Meta answered HTTP ${status}.`;
  return type ? `${type}: ${message}` : message;
}

async function testMeta(credentials: StringMap, config: MetaConfig): Promise<IntegrationTestResult> {
  const authorization = { Authorization: `Bearer ${credentials.accessToken}` };

  // Reading the dataset proves the token exists, is valid and can see this pixel.
  const probe = await safeFetch(
    `${META_GRAPH_ORIGIN}/${META_GRAPH_VERSION}/${config.pixelId}?fields=name`,
    TEST_TIMEOUT_MS,
    { headers: authorization, readBody: true },
  );
  if (probe.status !== 200) {
    return { ok: false, detail: metaError(probe.body, probe.status) };
  }

  const pixelName = asText(parseJson(probe.body).name) || config.pixelId;
  if (!config.testEventCode) {
    return {
      ok: true,
      detail: `Token is valid and can see pixel "${pixelName}". Add a test event code to send a real event.`,
    };
  }

  // With a test event code the check goes all the way: a real event lands in Test Events.
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({
    data: [
      {
        event_name: config.eventName,
        event_time: nowSeconds,
        action_source: 'system_generated',
        event_id: `tgpulse-test-${nowSeconds}`,
        user_data: { fbc: `fb.1.${nowSeconds * 1000}.tgpulse_test` },
      },
    ],
    test_event_code: config.testEventCode,
  });

  const send = await safeFetch(
    `${META_GRAPH_ORIGIN}/${META_GRAPH_VERSION}/${config.pixelId}/events`,
    TEST_TIMEOUT_MS,
    {
      method: 'POST',
      headers: { ...authorization, 'Content-Type': 'application/json' },
      body: payload,
      readBody: true,
    },
  );
  if (send.status !== 200) {
    return { ok: false, detail: metaError(send.body, send.status) };
  }

  const received = Number(parseJson(send.body).events_received ?? 0);
  return {
    ok: true,
    detail: `Pixel "${pixelName}" accepted the test event (${received} received). Check Test Events with code ${config.testEventCode}.`,
  };
}

// ---------- Yandex ----------

/** Metrica returns `{ errors: [{ message }], message }`; either field may carry the useful text. */
function yandexError(body: string, status: number): string {
  const parsed = parseJson(body);
  const errors = Array.isArray(parsed.errors) ? parsed.errors : [];
  const first = asText(asRecord(errors[0]).message);
  return first || asText(parsed.message) || `Metrica answered HTTP ${status}.`;
}

/**
 * TikTok has no lightweight credential probe: the pixel-scoped token carries neither an
 * advertiser id nor an OAuth app, so every GET would fail for a valid token. Instead we post
 * one deduplicated ViewContent probe, never the configured conversion event, so a connection
 * check cannot inflate the metric campaigns optimize on.
 */
async function testTikTok(
  credentials: StringMap,
  config: TikTokConfig,
): Promise<IntegrationTestResult> {
  const body = {
    event_source: 'web',
    event_source_id: config.pixelCode,
    ...(config.testEventCode ? { test_event_code: config.testEventCode } : {}),
    data: [
      {
        event: 'ViewContent',
        event_time: Math.floor(Date.now() / 1000),
        event_id: `tgpulse-test-${config.pixelCode}`,
        user: {},
      },
    ],
  };

  const probe = await safeFetch(`${TIKTOK_ORIGIN}/open_api/v1.3/event/track/`, TEST_TIMEOUT_MS, {
    method: 'POST',
    headers: { 'Access-Token': credentials.accessToken, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    readBody: true,
  });

  // TikTok answers 200 even when it rejects the payload; the verdict lives in `code`.
  const payload = parseJson(probe.body);
  const code = typeof payload.code === 'number' ? payload.code : -1;
  const message = asText(payload.message) || `HTTP ${probe.status}`;

  if (code !== 0) {
    return { ok: false, detail: `TikTok rejected the test: ${message}` };
  }
  const destination = config.testEventCode ? 'Test Events' : 'live events';
  return { ok: true, detail: `Pixel ${config.pixelCode} accepted a test event (${destination}).` };
}

async function testYandex(
  credentials: StringMap,
  config: YandexConfig,
): Promise<IntegrationTestResult> {
  const authorization = { Authorization: `OAuth ${credentials.oauthToken}` };

  const probe = await safeFetch(
    `${YANDEX_METRIKA_ORIGIN}/management/v1/counter/${config.counterId}`,
    TEST_TIMEOUT_MS,
    { headers: authorization, readBody: true },
  );
  if (probe.status !== 200) {
    return { ok: false, detail: yandexError(probe.body, probe.status) };
  }

  const counter = asRecord(parseJson(probe.body).counter);
  const counterName = asText(counter.name) || `counter ${config.counterId}`;

  // The goal name must match Metrica character for character, so verify it rather than trust it.
  const goals = await safeFetch(
    `${YANDEX_METRIKA_ORIGIN}/management/v1/counter/${config.counterId}/goals`,
    TEST_TIMEOUT_MS,
    { headers: authorization, readBody: true },
  );
  if (goals.status !== 200) {
    return {
      ok: true,
      detail: `Token is valid for "${counterName}". The goal list could not be read, so the goal name was not verified.`,
    };
  }

  const parsedGoals = parseJson(goals.body).goals;
  const names = (Array.isArray(parsedGoals) ? parsedGoals : [])
    .map((goal) => asText(asRecord(goal).name))
    .filter((name) => name.length > 0);

  if (!names.includes(config.goalName)) {
    const known = names.slice(0, 5).join(', ');
    return {
      ok: false,
      detail: known
        ? `Token is valid for "${counterName}", but no goal is named "${config.goalName}". Goals on this counter: ${known}.`
        : `Token is valid for "${counterName}", but the counter has no goals yet. Create one and paste its exact name.`,
    };
  }

  return {
    ok: true,
    detail: `Connected to "${counterName}" and matched the goal "${config.goalName}". Make sure offline conversions are enabled under Data upload.`,
  };
}

// ---------- Google ----------

/** API errors arrive as `{ error: { message, status } }`, OAuth ones as `{ error, error_description }`. */
function googleError(body: string, status: number): string {
  const parsed = parseJson(body);
  const error = parsed.error;
  if (error && typeof error === 'object') {
    const message = asText(asRecord(error).message);
    const code = asText(asRecord(error).status);
    if (message) return code ? `${code}: ${message}` : message;
  }
  const oauthError = asText(error);
  if (oauthError) {
    const description = asText(parsed.error_description);
    return description ? `${oauthError}: ${description}` : oauthError;
  }
  return `Google answered HTTP ${status}.`;
}

/**
 * Two real calls, zero recorded data: the token refresh proves the OAuth client and
 * refresh token, then a `validateOnly` ingest proves the account, the conversion action
 * and the permission to upload into it. Mirrors apps/bot/src/integrations/google.ts.
 */
async function testGoogle(
  credentials: StringMap,
  config: GoogleConfig,
): Promise<IntegrationTestResult> {
  const tokenRes = await safeFetch(GOOGLE_OAUTH_TOKEN_URL, TEST_TIMEOUT_MS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
    readBody: true,
  });
  const accessToken = asText(parseJson(tokenRes.body).access_token);
  if (tokenRes.status !== 200 || !accessToken) {
    return {
      ok: false,
      detail: `Token refresh failed: ${googleError(tokenRes.body, tokenRes.status)}`,
    };
  }

  const probe = await safeFetch(`${GOOGLE_DATAMANAGER_ORIGIN}/v1/events:ingest`, TEST_TIMEOUT_MS, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      destinations: [
        {
          operatingAccount: { accountType: 'GOOGLE_ADS', accountId: config.operatingAccountId },
          ...(config.loginAccountId
            ? { loginAccount: { accountType: 'GOOGLE_ADS', accountId: config.loginAccountId } }
            : {}),
          productDestinationId: config.conversionActionId,
        },
      ],
      events: [
        {
          adIdentifiers: { gclid: 'tgpulse-connection-test' },
          eventTimestamp: new Date().toISOString(),
          transactionId: `tgpulse-test-${config.conversionActionId}`,
          eventSource: 'WEB',
        },
      ],
      consent: { adUserData: 'CONSENT_GRANTED', adPersonalization: 'CONSENT_GRANTED' },
      validateOnly: true,
    }),
    readBody: true,
  });
  if (probe.status !== 200) {
    return { ok: false, detail: googleError(probe.body, probe.status) };
  }

  return {
    ok: true,
    detail: `Conversion action ${config.conversionActionId} on account ${config.operatingAccountId} accepted a validate-only upload. Nothing was recorded.`,
  };
}

// ---------- entry point ----------

/**
 * Perform the platform's own verification call for one integration.
 * Credential and transport problems come back as `{ ok: false, detail }` rather than throwing,
 * so the route can answer 200 with the platform's message on screen.
 */
export async function runIntegrationTest(
  integration: AdIntegration,
): Promise<IntegrationTestResult> {
  const provider = integration.provider as AdProvider;
  const credentials = decryptCredentials(integration);

  // Config is parsed before the try so a malformed stored config surfaces as a 400,
  // not as a bogus "could not reach the platform".
  const run = ((): (() => Promise<IntegrationTestResult>) | null => {
    if (provider === 'META_CAPI') {
      const config = parseMetaConfig(integration.config);
      return () => testMeta(credentials, config);
    }
    if (provider === 'YANDEX_METRIKA') {
      const config = parseYandexConfig(integration.config);
      return () => testYandex(credentials, config);
    }
    if (provider === 'TIKTOK_EVENTS') {
      const config = parseTikTokConfig(integration.config);
      return () => testTikTok(credentials, config);
    }
    if (provider === 'GOOGLE_ADS') {
      const config = parseGoogleConfig(integration.config);
      return () => testGoogle(credentials, config);
    }
    return null;
  })();

  if (!run) {
    return { ok: false, detail: `${providerLabel(provider)} cannot be tested yet.` };
  }

  try {
    return await run();
  } catch (error) {
    return { ok: false, detail: transportDetail(error) };
  }
}
