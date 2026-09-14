/**
 * Telegram Mini App bridge (docs/superpowers/specs/2026-09-14-telegram-mini-app-settings-design.md, section 1).
 *
 * The dashboard runs unchanged inside Telegram. What differs in Mini App mode:
 *   - there is no session cookie; the client exchanges `initData` for a JWT through
 *     POST /api/auth/tma and keeps it in memory only (module state, gone on reload,
 *     which is fine because initData is constant for the whole open session);
 *   - `request()` in lib/api.ts attaches that token as a bearer header;
 *   - the Telegram chrome (header colour, BackButton) is driven from MiniAppBridge.
 *
 * Everything that touches `window` is guarded, so this module is safe to import from
 * code that also runs on the server and in vitest. Pure helpers live at the top and
 * carry the decisions, so they can be unit tested without a browser.
 */

/* ---------- minimal typing for window.Telegram.WebApp ---------- */

export interface TelegramBackButton {
  isVisible: boolean;
  show(): void;
  hide(): void;
  onClick(callback: () => void): void;
  offClick(callback: () => void): void;
}

export interface TelegramWebApp {
  /** Raw query-string payload signed by Telegram. Empty outside a Mini App. */
  initData: string;
  colorScheme: 'light' | 'dark';
  ready(): void;
  expand(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  BackButton: TelegramBackButton;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/* ---------- pure helpers ---------- */

/** Mini App mode is defined by a non-empty initData, not by the script being present. */
export function hasInitData(initData: string | null | undefined): boolean {
  return typeof initData === 'string' && initData.trim().length > 0;
}

/** Telegram's BackButton belongs on every dashboard page except the channel list root. */
export function shouldShowBackButton(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return normalized !== '/app' && normalized.startsWith('/app/');
}

/**
 * A Mini App opens with a single history entry, so `router.back()` would leave the
 * app instead of going to the channel list. Anything longer is safe to pop.
 */
export function canGoBack(historyLength: number): boolean {
  return historyLength > 1;
}

/**
 * Returns a new Headers object carrying the bearer token on top of whatever the caller
 * passed. Accepts every HeadersInit shape (Headers, tuples, record) and never mutates
 * the input, so the caller's RequestInit can be reused for a retry.
 */
export function mergeAuthHeaders(headers: HeadersInit | undefined, token: string): Headers {
  const merged = new Headers(headers);
  merged.set('Authorization', `Bearer ${token}`);
  return merged;
}

/** Narrows the /api/auth/tma envelope down to its token, or null on any other shape. */
export function parseTmaAuthResponse(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const envelope = body as { ok?: unknown; data?: { token?: unknown } | null };
  if (envelope.ok !== true || !envelope.data || typeof envelope.data !== 'object') return null;
  const { token } = envelope.data;
  return typeof token === 'string' && token.length > 0 ? token : null;
}

/* ---------- colour ---------- */

/**
 * OKLCH -> sRGB hex, the same math browsers use for `oklch()`. Telegram's
 * setHeaderColor only accepts `#rrggbb`, and the dashboard palette lives in oklch
 * (globals.css), so the conversion is done here instead of hardcoding a hex twin
 * that would drift from the CSS token.
 */
export function oklchToHex(lightness: number, chroma: number, hueDegrees: number): string {
  const hue = (hueDegrees * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);

  // OKLab -> LMS (cube roots), then LMS -> linear sRGB.
  const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;

  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  const toChannel = (value: number): string => {
    const clamped = Math.min(1, Math.max(0, value));
    const gamma = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
    return Math.round(gamma * 255)
      .toString(16)
      .padStart(2, '0');
  };

  return `#${linear.map(toChannel).join('')}`;
}

/** `--color-bg` from globals.css (oklch(11% 0.012 290)) as the hex Telegram wants. */
export const DASHBOARD_BG_HEX = oklchToHex(0.11, 0.012, 290);

/* ---------- browser bridge ---------- */

export const TMA_AUTH_PATH = '/api/auth/tma';

export function getWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

/** True when the page runs inside Telegram with a signed initData payload. */
export function isMiniApp(): boolean {
  return hasInitData(getWebApp()?.initData);
}

/* ---------- session (in-memory bearer token) ---------- */

interface TmaSessionState {
  token: string | null;
  /** In-flight exchange, shared by every concurrent request() call. */
  exchange: Promise<string | null> | null;
}

// Module state on purpose: the token must outlive components but never touch storage.
let session: TmaSessionState = { token: null, exchange: null };

export function getTmaToken(): string | null {
  return session.token;
}

/** Drops the token so the next ensureTmaSession() exchanges initData again. */
export function resetTmaSession(): void {
  session = { token: null, exchange: null };
}

async function exchangeInitData(initData: string): Promise<string | null> {
  try {
    const response = await fetch(TMA_AUTH_PATH, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });
    const body: unknown = await response.json().catch(() => null);
    return parseTmaAuthResponse(body);
  } catch {
    // Network failure: reported as "no session" so the caller can show a retry.
    return null;
  }
}

/**
 * Exchanges initData for a session token exactly once. Concurrent callers await the same
 * promise; a failed exchange clears the memo so a later call (or the user's retry) starts
 * fresh. Resolves to null outside a Mini App or when the server rejects the signature.
 */
export function ensureTmaSession(): Promise<string | null> {
  if (session.token) return Promise.resolve(session.token);
  if (session.exchange) return session.exchange;

  const initData = getWebApp()?.initData ?? '';
  if (!hasInitData(initData)) return Promise.resolve(null);

  const exchange = exchangeInitData(initData).then((token) => {
    session = token ? { token, exchange: null } : { token: null, exchange: null };
    return token;
  });
  session = { token: null, exchange };
  return exchange;
}

/**
 * Re-exchange after the server answered 401 with `staleToken`. Single-flight: when
 * another request already refreshed (the stored token differs) that token is
 * returned; when a refresh is in flight it is awaited; otherwise the memo is
 * dropped and one exchange starts. Parallel 401s therefore cost one round trip.
 */
export function refreshTmaSession(staleToken: string | null): Promise<string | null> {
  if (session.token && session.token !== staleToken) return Promise.resolve(session.token);
  if (session.exchange) return session.exchange;
  resetTmaSession();
  return ensureTmaSession();
}

/* ---------- Telegram chrome ---------- */

let isInitialised = false;

/**
 * Tells Telegram the page is ready, expands it to full height and paints the native
 * header/background with the dashboard background so the iframe edges do not flash a
 * different colour. Idempotent: MiniAppBridge mounts once per dashboard tree, but React
 * strict mode runs effects twice in development.
 */
export function initMiniApp(): void {
  const webApp = getWebApp();
  if (!webApp || isInitialised) return;
  isInitialised = true;

  webApp.ready();
  webApp.expand();
  try {
    webApp.setHeaderColor(DASHBOARD_BG_HEX);
    webApp.setBackgroundColor(DASHBOARD_BG_HEX);
  } catch (error) {
    // Older Telegram clients reject hex colours (only 'bg_color'/'secondary_bg_color').
    // Cosmetic only, so log and carry on instead of breaking the dashboard.
    console.warn('[tma] could not set Telegram colours', error);
  }
}

/** Test-only: forget module state between cases. */
export function __resetTmaModuleForTests(): void {
  session = { token: null, exchange: null };
  isInitialised = false;
}
