import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getPrisma, EventType } from '@tgpulse/db';
import { assertChannelAccess } from '@/server/access';
import { getSessionUserId } from '@/server/auth';
import { handleRouteError, jsonError, jsonOk, parseOrThrow, readJsonBody } from '@/server/http';
import { toLinkDto } from '@/server/links';
import { createChatInviteLink } from '@/server/telegram';

export const runtime = 'nodejs';

const SLUG_LENGTH = 8;

const optionalTag = z
  .string()
  .trim()
  .max(128)
  .optional()
  .transform((value) => (value ? value : undefined));

const createLinkSchema = z.object({
  label: z.string().trim().min(1).max(64),
  creative: optionalTag,
  utmSource: optionalTag,
  utmMedium: optionalTag,
  utmCampaign: optionalTag,
});

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id: channelId } = await ctx.params;
    await assertChannelAccess(userId, channelId);

    const prisma = getPrisma();
    const [links, eventGroups] = await Promise.all([
      prisma.trackedLink.findMany({
        where: { channelId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { clicks: true } } },
      }),
      prisma.memberEvent.groupBy({
        by: ['linkId', 'type'],
        where: { channelId, linkId: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const statsByLink = new Map<string, { joins: number; leaves: number }>();
    for (const group of eventGroups) {
      if (!group.linkId) continue;
      const stats = statsByLink.get(group.linkId) ?? { joins: 0, leaves: 0 };
      if (group.type === EventType.JOIN) stats.joins = group._count._all;
      else stats.leaves = group._count._all;
      statsByLink.set(group.linkId, stats);
    }

    return jsonOk(
      links.map((link) =>
        toLinkDto(link, {
          clicks: link._count.clicks,
          ...(statsByLink.get(link.id) ?? { joins: 0, leaves: 0 }),
        }),
      ),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id: channelId } = await ctx.params;
    const channel = await assertChannelAccess(userId, channelId);
    const body = parseOrThrow(createLinkSchema, await readJsonBody(req));

    // TelegramApiError propagates as 502 with the TG description.
    const inviteLink = await createChatInviteLink(channel.tgChatId, body.label);

    const link = await getPrisma().trackedLink.create({
      data: {
        slug: nanoid(SLUG_LENGTH),
        channelId: channel.id,
        label: body.label,
        creative: body.creative ?? null,
        utmSource: body.utmSource ?? null,
        utmMedium: body.utmMedium ?? null,
        utmCampaign: body.utmCampaign ?? null,
        inviteLink,
      },
    });

    return jsonOk(toLinkDto(link, { clicks: 0, joins: 0, leaves: 0 }));
  } catch (error) {
    return handleRouteError(error);
  }
}
