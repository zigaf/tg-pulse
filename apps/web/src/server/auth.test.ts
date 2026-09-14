import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createSessionJwt, resolveSessionToken } from './auth';

const SECRET_KEY = 'SESSION_SECRET';
const previousSecret = process.env[SECRET_KEY];

beforeAll(() => {
  // The HS256 key is read lazily on every sign/verify, so a test-local value is enough.
  process.env[SECRET_KEY] = 'unit-test-session-secret-at-least-32-bytes-long';
});

afterAll(() => {
  if (previousSecret === undefined) delete process.env[SECRET_KEY];
  else process.env[SECRET_KEY] = previousSecret;
});

describe('resolveSessionToken', () => {
  test('prefers a valid bearer token over the cookie', async () => {
    // Arrange
    const cookieToken = await createSessionJwt('user-from-cookie');
    const bearerToken = await createSessionJwt('user-from-header');

    // Act
    const userId = await resolveSessionToken(cookieToken, `Bearer ${bearerToken}`);

    // Assert
    expect(userId).toBe('user-from-header');
  });

  test('falls back to the cookie when no Authorization header is present', async () => {
    const cookieToken = await createSessionJwt('user-from-cookie');

    expect(await resolveSessionToken(cookieToken, null)).toBe('user-from-cookie');
    expect(await resolveSessionToken(cookieToken, undefined)).toBe('user-from-cookie');
  });

  test('falls back to the cookie when the bearer token is invalid', async () => {
    const cookieToken = await createSessionJwt('user-from-cookie');

    const userId = await resolveSessionToken(cookieToken, 'Bearer not-a-jwt');

    expect(userId).toBe('user-from-cookie');
  });

  test('ignores a malformed Authorization header and uses the cookie', async () => {
    const cookieToken = await createSessionJwt('user-from-cookie');
    const validToken = await createSessionJwt('user-from-header');

    expect(await resolveSessionToken(cookieToken, `Basic ${validToken}`)).toBe('user-from-cookie');
    expect(await resolveSessionToken(cookieToken, validToken)).toBe('user-from-cookie');
    expect(await resolveSessionToken(cookieToken, 'Bearer')).toBe('user-from-cookie');
    expect(await resolveSessionToken(cookieToken, 'Bearer ')).toBe('user-from-cookie');
  });

  test('accepts the Bearer scheme case-insensitively and trims surrounding whitespace', async () => {
    const bearerToken = await createSessionJwt('user-from-header');

    expect(await resolveSessionToken(undefined, `bearer ${bearerToken}`)).toBe('user-from-header');
    expect(await resolveSessionToken(undefined, `  Bearer   ${bearerToken}  `)).toBe(
      'user-from-header',
    );
  });

  test('returns null when neither source carries a usable session', async () => {
    expect(await resolveSessionToken(undefined, null)).toBeNull();
    expect(await resolveSessionToken('', '')).toBeNull();
    expect(await resolveSessionToken('garbage', 'Bearer garbage')).toBeNull();
  });
});
