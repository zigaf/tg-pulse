import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { getPrisma, type User } from '@tgpulse/db';
import { requireEnv } from './env';

export const SESSION_COOKIE = 'tgp_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const LOGIN_MAX_AGE_SECONDS = 60 * 60 * 24; // Telegram auth_date valid for 24h

/** Minimal cookie reader satisfied by both NextRequest.cookies and next/headers cookies(). */
export interface CookieReader {
  get(name: string): { value: string } | undefined;
}

/**
 * Verify a Telegram Login Widget payload.
 * data_check_string = sorted `key=value` lines of every field except `hash`;
 * secret = SHA256(BOT_TOKEN); signature = HMAC-SHA256(secret, data_check_string).
 */
export function verifyTelegramLogin(data: Record<string, string | number>): boolean {
  const hash = data.hash;
  if (typeof hash !== 'string' || hash.length === 0) return false;

  const checkString = Object.keys(data)
    .filter((key) => key !== 'hash')
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join('\n');

  const secret = createHash('sha256').update(requireEnv('BOT_TOKEN')).digest();
  const expected = createHmac('sha256', secret).update(checkString).digest();
  const actual = Buffer.from(hash, 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(expected, actual)) {
    return false;
  }

  const authDate = Number(data.auth_date);
  if (!Number.isFinite(authDate)) return false;
  return Math.floor(Date.now() / 1000) - authDate <= LOGIN_MAX_AGE_SECONDS;
}

function sessionKey(): Uint8Array {
  return new TextEncoder().encode(requireEnv('SESSION_SECRET'));
}

export async function createSessionJwt(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(sessionKey());
}

/** Returns the userId from a valid session JWT, or null for missing/invalid/expired tokens. */
export async function readSessionJwt(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, sessionKey(), { algorithms: ['HS256'] });
    return typeof payload.userId === 'string' ? payload.userId : null;
  } catch {
    return null;
  }
}

export async function getSessionUserId(cookies: CookieReader): Promise<string | null> {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return readSessionJwt(token);
}

export async function getSessionUser(cookies: CookieReader): Promise<User | null> {
  const userId = await getSessionUserId(cookies);
  if (!userId) return null;
  return getPrisma().user.findUnique({ where: { id: userId } });
}

/** API-safe user shape (BigInt tgId serialized as string). */
export function toUserDto(user: User) {
  return {
    id: user.id,
    tgId: user.tgId.toString(),
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    photoUrl: user.photoUrl,
  };
}

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}
