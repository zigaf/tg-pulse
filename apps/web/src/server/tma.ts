import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Freshness window for a Mini App's `auth_date`. initData is constant for the
 * whole time the app stays open, so there is no one-time nonce here (a reload
 * would fail); this window is the replay bound instead.
 */
export const TMA_MAX_AGE_SECONDS = 60 * 60;

/** Telegram user as carried in the `user` field of initData, normalised to camelCase. */
export interface TmaUser {
  id: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  languageCode?: string;
}

const HASH_FIELD = 'hash';
const SECRET_KEY_SEED = 'WebAppData';

/**
 * data_check_string per the Mini Apps spec: every field except `hash`, sorted by
 * key, joined as `key=value` lines. Values are the URL-decoded strings.
 */
function dataCheckString(params: URLSearchParams): string {
  return [...params.entries()]
    .filter(([key]) => key !== HASH_FIELD)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

/** secret = HMAC-SHA256(key="WebAppData", msg=BOT_TOKEN); hash = HMAC-SHA256(secret, dcs). */
function signDataCheckString(checkString: string, botToken: string): Buffer {
  const secret = createHmac('sha256', SECRET_KEY_SEED).update(botToken).digest();
  return createHmac('sha256', secret).update(checkString).digest();
}

function hasValidSignature(params: URLSearchParams, botToken: string): boolean {
  const hash = params.get(HASH_FIELD);
  if (!hash) return false;

  const expected = signDataCheckString(dataCheckString(params), botToken);
  const actual = Buffer.from(hash, 'hex');
  // timingSafeEqual throws on length mismatch, so guard it explicitly.
  return actual.length === expected.length && timingSafeEqual(expected, actual);
}

function isFresh(params: URLSearchParams, nowMs: number): boolean {
  const raw = params.get('auth_date');
  if (raw === null || !/^\d+$/.test(raw)) return false;
  const authDate = Number(raw);
  return Math.floor(nowMs / 1000) - authDate <= TMA_MAX_AGE_SECONDS;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Parse the `user` JSON field; null when absent, malformed, or without a positive integer id. */
function parseUser(params: URLSearchParams): TmaUser | null {
  const raw = params.get('user');
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const record = parsed as Record<string, unknown>;
  const id = record.id;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) return null;

  const profile = {
    firstName: optionalString(record.first_name),
    lastName: optionalString(record.last_name),
    username: optionalString(record.username),
    photoUrl: optionalString(record.photo_url),
    languageCode: optionalString(record.language_code),
  };
  // Drop absent keys so the result compares cleanly and never carries `undefined` noise.
  const present = Object.entries(profile).filter(([, value]) => value !== undefined);
  return { id, ...Object.fromEntries(present) };
}

/**
 * Verify `window.Telegram.WebApp.initData` (the URL-encoded query string) against
 * the bot token. Returns the embedded user on success, null on any failure:
 * bad/missing signature, stale or missing `auth_date`, or an unusable `user`.
 */
export function verifyTmaInitData(
  initData: string,
  botToken: string,
  now: number = Date.now(),
): TmaUser | null {
  if (!initData) return null;
  const params = new URLSearchParams(initData);

  if (!hasValidSignature(params, botToken)) return null;
  if (!isFresh(params, now)) return null;
  return parseUser(params);
}

/**
 * Build a signed initData string the way Telegram would. Test helper: lets the
 * verifier be exercised without a real client. Values are signed as given.
 */
export function buildTmaInitData(fields: Record<string, string>, botToken: string): string {
  const params = new URLSearchParams(
    Object.entries(fields).filter(([key]) => key !== HASH_FIELD),
  );
  const hash = signDataCheckString(dataCheckString(params), botToken).toString('hex');
  params.set(HASH_FIELD, hash);
  return params.toString();
}
