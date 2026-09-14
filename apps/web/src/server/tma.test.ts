import { describe, expect, test } from 'vitest';
import { buildTmaInitData, TMA_MAX_AGE_SECONDS, verifyTmaInitData } from './tma';

const BOT_TOKEN = '123456:test-bot-token';
const NOW_MS = 1_800_000_000_000;
const NOW_SECONDS = Math.floor(NOW_MS / 1000);

const TELEGRAM_USER = {
  id: 42,
  first_name: 'Ada',
  last_name: 'Lovelace',
  username: 'ada',
  photo_url: 'https://t.me/i/userpic/320/ada.jpg',
  language_code: 'en',
};

/** Signed initData for a fresh session; callers override individual fields per test. */
function freshInitData(
  overrides: Record<string, string> = {},
  botToken = BOT_TOKEN,
): string {
  return buildTmaInitData(
    {
      auth_date: String(NOW_SECONDS - 30),
      query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
      user: JSON.stringify(TELEGRAM_USER),
      ...overrides,
    },
    botToken,
  );
}

describe('verifyTmaInitData', () => {
  test('accepts a freshly signed payload and returns the normalised user', () => {
    // Arrange
    const initData = freshInitData();

    // Act
    const user = verifyTmaInitData(initData, BOT_TOKEN, NOW_MS);

    // Assert
    expect(user).toEqual({
      id: 42,
      firstName: 'Ada',
      lastName: 'Lovelace',
      username: 'ada',
      photoUrl: 'https://t.me/i/userpic/320/ada.jpg',
      languageCode: 'en',
    });
  });

  test('keeps optional profile fields undefined when Telegram omits them', () => {
    const initData = freshInitData({ user: JSON.stringify({ id: 7 }) });

    const user = verifyTmaInitData(initData, BOT_TOKEN, NOW_MS);

    expect(user).toEqual({ id: 7 });
  });

  test('rejects a payload whose field was changed after signing', () => {
    // Arrange: re-encode with a different user id but keep the original hash.
    const signed = new URLSearchParams(freshInitData());
    signed.set('user', JSON.stringify({ ...TELEGRAM_USER, id: 43 }));

    // Act
    const user = verifyTmaInitData(signed.toString(), BOT_TOKEN, NOW_MS);

    // Assert
    expect(user).toBeNull();
  });

  test('rejects a payload signed by a different bot token', () => {
    const initData = freshInitData({}, '999999:another-bot');

    expect(verifyTmaInitData(initData, BOT_TOKEN, NOW_MS)).toBeNull();
  });

  test('rejects a hash of the wrong length without throwing', () => {
    const signed = new URLSearchParams(freshInitData());
    signed.set('hash', 'abc');

    expect(verifyTmaInitData(signed.toString(), BOT_TOKEN, NOW_MS)).toBeNull();
  });

  test('rejects a payload without a hash', () => {
    const signed = new URLSearchParams(freshInitData());
    signed.delete('hash');

    expect(verifyTmaInitData(signed.toString(), BOT_TOKEN, NOW_MS)).toBeNull();
  });

  test('rejects auth_date older than the freshness window', () => {
    const initData = freshInitData({
      auth_date: String(NOW_SECONDS - TMA_MAX_AGE_SECONDS - 1),
    });

    expect(verifyTmaInitData(initData, BOT_TOKEN, NOW_MS)).toBeNull();
  });

  test('accepts auth_date exactly at the freshness window boundary', () => {
    const initData = freshInitData({ auth_date: String(NOW_SECONDS - TMA_MAX_AGE_SECONDS) });

    expect(verifyTmaInitData(initData, BOT_TOKEN, NOW_MS)).not.toBeNull();
  });

  test('rejects a missing or non-numeric auth_date even when correctly signed', () => {
    const withoutAuthDate = buildTmaInitData({ user: JSON.stringify(TELEGRAM_USER) }, BOT_TOKEN);
    const garbageAuthDate = freshInitData({ auth_date: 'yesterday' });

    expect(verifyTmaInitData(withoutAuthDate, BOT_TOKEN, NOW_MS)).toBeNull();
    expect(verifyTmaInitData(garbageAuthDate, BOT_TOKEN, NOW_MS)).toBeNull();
  });

  test('rejects a payload without a user field', () => {
    const initData = buildTmaInitData(
      { auth_date: String(NOW_SECONDS), query_id: 'AAH' },
      BOT_TOKEN,
    );

    expect(verifyTmaInitData(initData, BOT_TOKEN, NOW_MS)).toBeNull();
  });

  test('rejects a user that is not valid JSON or has no positive integer id', () => {
    const notJson = freshInitData({ user: '{not json' });
    const negativeId = freshInitData({ user: JSON.stringify({ id: -1 }) });
    const fractionalId = freshInitData({ user: JSON.stringify({ id: 1.5 }) });
    const stringId = freshInitData({ user: JSON.stringify({ id: '42' }) });

    expect(verifyTmaInitData(notJson, BOT_TOKEN, NOW_MS)).toBeNull();
    expect(verifyTmaInitData(negativeId, BOT_TOKEN, NOW_MS)).toBeNull();
    expect(verifyTmaInitData(fractionalId, BOT_TOKEN, NOW_MS)).toBeNull();
    expect(verifyTmaInitData(stringId, BOT_TOKEN, NOW_MS)).toBeNull();
  });

  test('returns null for an empty or malformed initData string', () => {
    expect(verifyTmaInitData('', BOT_TOKEN, NOW_MS)).toBeNull();
    expect(verifyTmaInitData('hash=', BOT_TOKEN, NOW_MS)).toBeNull();
  });
});

describe('buildTmaInitData', () => {
  test('produces a URL-encoded query string carrying a 64-char hex hash', () => {
    const params = new URLSearchParams(freshInitData());

    expect(params.get('hash')).toMatch(/^[0-9a-f]{64}$/);
    expect(params.get('user')).toBe(JSON.stringify(TELEGRAM_USER));
  });

  test('signs the same fields to the same hash regardless of insertion order', () => {
    const a = new URLSearchParams(buildTmaInitData({ b: '2', a: '1', auth_date: '1' }, BOT_TOKEN));
    const b = new URLSearchParams(buildTmaInitData({ auth_date: '1', a: '1', b: '2' }, BOT_TOKEN));

    expect(a.get('hash')).toBe(b.get('hash'));
  });
});
