import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSessionJwt, toUserDto, upsertTelegramUser } from '@/server/auth';
import { requireEnv } from '@/server/env';
import { handleRouteError, jsonError, jsonOk, parseOrThrow, readJsonBody } from '@/server/http';
import { clientIp, enforceRateLimit } from '@/server/rate-limit';
import { verifyTmaInitData } from '@/server/tma';

export const runtime = 'nodejs';

// Real initData is well under 1 KiB; the cap only bounds HMAC work on junk input.
const MAX_INIT_DATA_LENGTH = 8192;

const tmaLoginSchema = z.object({
  initData: z.string().min(1).max(MAX_INIT_DATA_LENGTH),
});

/**
 * Telegram Mini App sign-in: exchanges `window.Telegram.WebApp.initData` for a
 * session JWT. The token is returned in the body only — cookies are unreliable
 * inside Telegram's WebView, so the client keeps it in memory and sends it as a
 * bearer header. No one-time nonce: initData stays constant while the app is
 * open, so the `auth_date` freshness window is the replay bound.
 */
export async function POST(req: NextRequest) {
  try {
    // Same budget as the widget login: unauthenticated, does HMAC work and writes a user.
    enforceRateLimit(`login-tma:${clientIp(req)}`, 20, 60_000);
    const { initData } = parseOrThrow(tmaLoginSchema, await readJsonBody(req));

    const tmaUser = verifyTmaInitData(initData, requireEnv('BOT_TOKEN'));
    if (!tmaUser) {
      return jsonError(401, 'Telegram Mini App verification failed');
    }

    const user = await upsertTelegramUser(BigInt(tmaUser.id), {
      username: tmaUser.username,
      firstName: tmaUser.firstName,
      lastName: tmaUser.lastName,
      photoUrl: tmaUser.photoUrl,
    });

    const token = await createSessionJwt(user.id);
    return jsonOk({ token, user: toUserDto(user) });
  } catch (error) {
    return handleRouteError(error);
  }
}
