import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { getPrisma, Prisma, type User } from '@tgpulse/db';
import { requireEnv } from './env';

export const SESSION_COOKIE = 'tgp_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
/**
 * Freshness window for the widget's auth_date. The widget signs the payload at
 * the moment of the click, so 10 minutes is plenty; combined with the one-time
 * nonce check in the login route this closes replay of intercepted payloads.
 */
export const LOGIN_MAX_AGE_SECONDS = 60 * 10;

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

/**
 * One-time use of a verified login payload: the signed hash is stored under a
 * primary key, so a second submission of the same payload fails. Returns false
 * when the hash was already consumed. Old rows are pruned in the background;
 * anything past the pruned age is rejected by the auth_date check anyway.
 */
export async function consumeLoginNonce(hash: string): Promise<boolean> {
  const prisma = getPrisma();
  try {
    await prisma.loginNonce.create({ data: { hash } });
  } catch (error) {
    // Unique violation: this exact payload has signed someone in already.
    // Anything else (a database outage) must surface as a 500, not as "already used".
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return false;
    }
    throw error;
  }

  // Sampled prune (~1 in 16 logins, keyed on the hash so it stays deterministic):
  // an every-login deleteMany would double DB round-trips exactly during login bursts.
  if (parseInt(hash[0] ?? '0', 16) === 0) {
    const pruneBefore = new Date(Date.now() - 2 * LOGIN_MAX_AGE_SECONDS * 1000);
    void prisma.loginNonce
      .deleteMany({ where: { createdAt: { lt: pruneBefore } } })
      .catch(() => undefined);
  }
  return true;
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
