import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPrisma } from '@tgpulse/db';
import { assertChannelAccess } from '@/server/access';
import { getSessionUserId } from '@/server/auth';
import { handleRouteError, jsonError, jsonOk, parseOrThrow, readJsonBody, requestOrigin } from '@/server/http';
import { assertCanMutateChannel } from '@/server/roles';
import {
  assertShareLinkCapacity,
  createShareToken,
  MAX_SHARE_EXPIRY_DAYS,
  shareExpiry,
  SHARE_WINDOW_DAYS,
  toShareLinkDto,
  type ShareWindowDays,
} from '@/server/share-links';

export const runtime = 'nodejs';

const LABEL_MAX_LENGTH = 64;

const createShareLinkSchema = z.object({
  label: z
    .string()
    .trim()
    .max(LABEL_MAX_LENGTH)
    .optional()
    .transform((value) => (value ? value : undefined)),
  windowDays: z.coerce
    .number()
    .int()
    .refine((days): days is ShareWindowDays => (SHARE_WINDOW_DAYS as readonly number[]).includes(days), {
      message: `must be one of ${SHARE_WINDOW_DAYS.join(', ')}`,
    }),
  expiresInDays: z.coerce.number().int().min(1).max(MAX_SHARE_EXPIRY_DAYS).optional(),
});

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id: channelId } = await ctx.params;
    await assertChannelAccess(userId, channelId);

    const links = await getPrisma().shareLink.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
    });

    const origin = requestOrigin(req);
    return jsonOk(links.map((link) => toShareLinkDto(link, origin)));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id: channelId } = await ctx.params;
    await assertCanMutateChannel(userId, channelId);

    const body = parseOrThrow(createShareLinkSchema, await readJsonBody(req));
    await assertShareLinkCapacity(channelId);

    const link = await getPrisma().shareLink.create({
      data: {
        channelId,
        token: createShareToken(),
        label: body.label ?? null,
        windowDays: body.windowDays,
        expiresAt: shareExpiry(body.expiresInDays),
        createdById: userId,
      },
    });

    return jsonOk(toShareLinkDto(link, requestOrigin(req)));
  } catch (error) {
    return handleRouteError(error);
  }
}
