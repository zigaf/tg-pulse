import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPrisma, Prisma } from '@tgpulse/db';
import { assertChannelAccess } from '@/server/access';
import { getSessionUserId } from '@/server/auth';
import { handleRouteError, jsonError, jsonOk, parseOrThrow } from '@/server/http';

export const runtime = 'nodejs';

const DEFAULT_TAKE = 50;
const MAX_TAKE = 100;

const querySchema = z.object({
  cursor: z.string().min(1).optional(),
  take: z.coerce.number().int().min(1).max(MAX_TAKE).default(DEFAULT_TAKE),
  q: z.string().min(1).optional(),
});

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id: channelId } = await ctx.params;
    await assertChannelAccess(userId, channelId);

    const sp = req.nextUrl.searchParams;
    const query = parseOrThrow(querySchema, {
      cursor: sp.get('cursor') ?? undefined,
      take: sp.get('take') ?? undefined,
      q: sp.get('q')?.trim() || undefined,
    });

    const search: Prisma.SubscriberWhereInput = query.q
      ? {
          OR: [
            { username: { contains: query.q, mode: 'insensitive' } },
            { firstName: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {};

    const subscribers = await getPrisma().subscriber.findMany({
      where: { channelId, ...search },
      orderBy: [{ joinedAt: 'desc' }, { id: 'desc' }],
      take: query.take,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: { link: { select: { label: true } } },
    });

    const items = subscribers.map((sub) => ({
      tgUserId: sub.tgUserId.toString(),
      username: sub.username,
      firstName: sub.firstName,
      isPremium: sub.isPremium,
      joinedAt: sub.joinedAt,
      leftAt: sub.leftAt,
      source: sub.link ? { label: sub.link.label } : null,
    }));

    const nextCursor =
      subscribers.length === query.take ? subscribers[subscribers.length - 1].id : null;

    return jsonOk({ items, nextCursor });
  } catch (error) {
    return handleRouteError(error);
  }
}
