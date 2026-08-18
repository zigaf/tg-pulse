import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPrisma } from '@tgpulse/db';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionJwt,
  sessionCookieOptions,
  toUserDto,
  verifyTelegramLogin,
} from '@/server/auth';
import { handleRouteError, jsonError, jsonOk, parseOrThrow, readJsonBody } from '@/server/http';

export const runtime = 'nodejs';

const scalar = z.union([z.string(), z.number()]);

// Widget payload: id, first_name, username?, photo_url?, auth_date, hash (+ possible extras).
const loginSchema = z.looseObject({
  id: scalar.refine((v) => /^\d+$/.test(String(v)), 'must be a numeric Telegram id'),
  auth_date: scalar,
  hash: z.string().min(1),
});

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = parseOrThrow(loginSchema, await readJsonBody(req));

    // Only scalar fields participate in the signature check (mirrors what the widget signs).
    const signedFields: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string' || typeof value === 'number') {
        signedFields[key] = value;
      }
    }
    if (!verifyTelegramLogin(signedFields)) {
      return jsonError(401, 'Telegram login verification failed');
    }

    const prisma = getPrisma();
    const profile = {
      username: optionalString(body.username),
      firstName: optionalString(body.first_name),
      lastName: optionalString(body.last_name),
      photoUrl: optionalString(body.photo_url),
    };
    const user = await prisma.user.upsert({
      where: { tgId: BigInt(String(body.id)) },
      update: profile,
      create: { tgId: BigInt(String(body.id)), ...profile },
    });

    const membership = await prisma.membership.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    if (!membership) {
      await prisma.workspace.create({
        data: {
          name: profile.firstName ?? profile.username ?? 'My workspace',
          members: { create: { userId: user.id, role: 'OWNER' } },
        },
      });
    }

    const token = await createSessionJwt(user.id);
    const res = jsonOk({ user: toUserDto(user) });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_MAX_AGE_SECONDS));
    return res;
  } catch (error) {
    return handleRouteError(error);
  }
}
