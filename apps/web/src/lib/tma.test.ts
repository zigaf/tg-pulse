import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  __resetTmaModuleForTests,
  canGoBack,
  DASHBOARD_BG_HEX,
  ensureTmaSession,
  getTmaToken,
  hasInitData,
  initMiniApp,
  isMiniApp,
  mergeAuthHeaders,
  oklchToHex,
  parseTmaAuthResponse,
  refreshTmaSession,
  resetTmaSession,
  shouldShowBackButton,
  TMA_AUTH_PATH,
  type TelegramWebApp,
} from './tma';

describe('hasInitData', () => {
  test('is true only for a non-blank string', () => {
    expect(hasInitData('query_id=1&user=%7B%7D&hash=abc')).toBe(true);
    expect(hasInitData('')).toBe(false);
    expect(hasInitData('   ')).toBe(false);
    expect(hasInitData(undefined)).toBe(false);
    expect(hasInitData(null)).toBe(false);
  });
});

describe('shouldShowBackButton', () => {
  test('hides the button on the channel list root', () => {
    expect(shouldShowBackButton('/app')).toBe(false);
    expect(shouldShowBackButton('/app/')).toBe(false);
  });

  test('shows it on every nested dashboard route', () => {
    expect(shouldShowBackButton('/app/team')).toBe(true);
    expect(shouldShowBackButton('/app/billing')).toBe(true);
    expect(shouldShowBackButton('/app/channels/abc')).toBe(true);
    expect(shouldShowBackButton('/app/channels/abc/integrations')).toBe(true);
  });

  test('ignores routes outside the dashboard and unknown pathnames', () => {
    expect(shouldShowBackButton('/')).toBe(false);
    expect(shouldShowBackButton('/apple')).toBe(false);
    expect(shouldShowBackButton('/invite/x')).toBe(false);
    expect(shouldShowBackButton(null)).toBe(false);
    expect(shouldShowBackButton(undefined)).toBe(false);
  });
});

describe('canGoBack', () => {
  test('a single history entry means the Mini App opened straight onto this page', () => {
    expect(canGoBack(0)).toBe(false);
    expect(canGoBack(1)).toBe(false);
    expect(canGoBack(2)).toBe(true);
  });
});

describe('mergeAuthHeaders', () => {
  test('adds the bearer header on top of a record', () => {
    const headers = mergeAuthHeaders({ 'Content-Type': 'application/json' }, 'tok');
    expect(headers.get('Authorization')).toBe('Bearer tok');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  test('accepts tuples, Headers and undefined', () => {
    expect(mergeAuthHeaders([['X-A', '1']], 't').get('X-A')).toBe('1');
    expect(mergeAuthHeaders(new Headers({ 'X-B': '2' }), 't').get('X-B')).toBe('2');
    expect(mergeAuthHeaders(undefined, 't').get('Authorization')).toBe('Bearer t');
  });

  test('does not mutate the caller headers', () => {
    const original = new Headers({ 'X-A': '1' });
    mergeAuthHeaders(original, 't');
    expect(original.has('Authorization')).toBe(false);
  });

  test('replaces a stale Authorization header instead of appending', () => {
    const headers = mergeAuthHeaders({ Authorization: 'Bearer old' }, 'new');
    expect(headers.get('Authorization')).toBe('Bearer new');
  });
});

describe('parseTmaAuthResponse', () => {
  test('extracts the token from the success envelope', () => {
    expect(parseTmaAuthResponse({ ok: true, data: { token: 'jwt', user: {} } })).toBe('jwt');
  });

  test('returns null for failures and malformed bodies', () => {
    expect(parseTmaAuthResponse({ ok: false, error: 'bad signature' })).toBeNull();
    expect(parseTmaAuthResponse({ ok: true, data: { token: '' } })).toBeNull();
    expect(parseTmaAuthResponse({ ok: true, data: null })).toBeNull();
    expect(parseTmaAuthResponse({ ok: true })).toBeNull();
    expect(parseTmaAuthResponse(null)).toBeNull();
    expect(parseTmaAuthResponse('jwt')).toBeNull();
  });
});

describe('oklchToHex', () => {
  test('matches the browser rendering of the dashboard background', () => {
    // oklch(11% 0.012 290) as computed by the CSS Color 4 reference conversion.
    expect(oklchToHex(0.11, 0.012, 290)).toBe('#040408');
    expect(DASHBOARD_BG_HEX).toBe('#040408');
  });

  test('handles the achromatic extremes', () => {
    expect(oklchToHex(0, 0, 0)).toBe('#000000');
    expect(oklchToHex(1, 0, 0)).toBe('#ffffff');
  });

  test('clamps out-of-gamut channels instead of producing invalid hex', () => {
    expect(oklchToHex(0.9, 0.4, 145)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

/* ---------- browser bridge with a fake window.Telegram ---------- */

function fakeWebApp(initData: string): TelegramWebApp {
  return {
    initData,
    colorScheme: 'dark',
    ready: vi.fn(),
    expand: vi.fn(),
    setHeaderColor: vi.fn(),
    setBackgroundColor: vi.fn(),
    BackButton: { isVisible: false, show: vi.fn(), hide: vi.fn(), onClick: vi.fn(), offClick: vi.fn() },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('ensureTmaSession', () => {
  beforeEach(() => {
    __resetTmaModuleForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('is a no-op outside a Mini App', async () => {
    vi.stubGlobal('window', { Telegram: { WebApp: fakeWebApp('') } });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(isMiniApp()).toBe(false);
    await expect(ensureTmaSession()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('exchanges initData once and shares the promise between concurrent callers', async () => {
    vi.stubGlobal('window', { Telegram: { WebApp: fakeWebApp('user=1&hash=abc') } });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true, data: { token: 'jwt-1', user: {} } }));
    vi.stubGlobal('fetch', fetchMock);

    expect(isMiniApp()).toBe(true);
    const [first, second] = await Promise.all([ensureTmaSession(), ensureTmaSession()]);
    const third = await ensureTmaSession();

    expect(first).toBe('jwt-1');
    expect(second).toBe('jwt-1');
    expect(third).toBe('jwt-1');
    expect(getTmaToken()).toBe('jwt-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(TMA_AUTH_PATH);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ initData: 'user=1&hash=abc' });
  });

  test('forgets a failed exchange so the next call retries', async () => {
    vi.stubGlobal('window', { Telegram: { WebApp: fakeWebApp('user=1&hash=bad') } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: false, error: 'Invalid signature' }, 401))
      .mockResolvedValueOnce(jsonResponse({ ok: true, data: { token: 'jwt-2', user: {} } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(ensureTmaSession()).resolves.toBeNull();
    expect(getTmaToken()).toBeNull();
    await expect(ensureTmaSession()).resolves.toBe('jwt-2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('treats a network error as a failed exchange', async () => {
    vi.stubGlobal('window', { Telegram: { WebApp: fakeWebApp('user=1&hash=abc') } });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    await expect(ensureTmaSession()).resolves.toBeNull();
    expect(getTmaToken()).toBeNull();
  });

  test('refreshTmaSession exchanges once for concurrent 401 handlers holding the same stale token', async () => {
    vi.stubGlobal('window', { Telegram: { WebApp: fakeWebApp('user=1&hash=abc') } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, data: { token: 'jwt-1', user: {} } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, data: { token: 'jwt-2', user: {} } }));
    vi.stubGlobal('fetch', fetchMock);

    const stale = await ensureTmaSession();
    const [first, second] = await Promise.all([refreshTmaSession(stale), refreshTmaSession(stale)]);

    expect(first).toBe('jwt-2');
    expect(second).toBe('jwt-2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('refreshTmaSession returns the current token when another caller already refreshed', async () => {
    vi.stubGlobal('window', { Telegram: { WebApp: fakeWebApp('user=1&hash=abc') } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, data: { token: 'jwt-1', user: {} } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, data: { token: 'jwt-2', user: {} } }));
    vi.stubGlobal('fetch', fetchMock);

    const stale = await ensureTmaSession();
    await refreshTmaSession(stale);
    await expect(refreshTmaSession(stale)).resolves.toBe('jwt-2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('resetTmaSession drops the token and forces a new exchange', async () => {
    vi.stubGlobal('window', { Telegram: { WebApp: fakeWebApp('user=1&hash=abc') } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, data: { token: 'jwt-1', user: {} } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, data: { token: 'jwt-2', user: {} } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(ensureTmaSession()).resolves.toBe('jwt-1');
    resetTmaSession();
    expect(getTmaToken()).toBeNull();
    await expect(ensureTmaSession()).resolves.toBe('jwt-2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('initMiniApp', () => {
  beforeEach(() => {
    __resetTmaModuleForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('readies, expands and paints the Telegram chrome once', () => {
    const webApp = fakeWebApp('user=1&hash=abc');
    vi.stubGlobal('window', { Telegram: { WebApp: webApp } });

    initMiniApp();
    initMiniApp();

    expect(webApp.ready).toHaveBeenCalledTimes(1);
    expect(webApp.expand).toHaveBeenCalledTimes(1);
    expect(webApp.setHeaderColor).toHaveBeenCalledWith(DASHBOARD_BG_HEX);
    expect(webApp.setBackgroundColor).toHaveBeenCalledWith(DASHBOARD_BG_HEX);
  });

  test('survives clients that reject hex colours', () => {
    const webApp = fakeWebApp('user=1&hash=abc');
    webApp.setHeaderColor = vi.fn(() => {
      throw new Error('WebAppMethodUnsupported');
    });
    vi.stubGlobal('window', { Telegram: { WebApp: webApp } });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(() => initMiniApp()).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  test('does nothing without the Telegram SDK', () => {
    vi.stubGlobal('window', {});
    expect(() => initMiniApp()).not.toThrow();
  });
});
