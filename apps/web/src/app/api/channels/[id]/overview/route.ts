import type { NextRequest } from 'next/server';
import { getPrisma, EventType, type Channel } from '@tgpulse/db';
import { assertChannelAccess } from '@/server/access';
import { getSessionUserId } from '@/server/auth';
import { ApiError, handleRouteError, jsonError, jsonOk } from '@/server/http';

export const runtime = 'nodejs';

const DAY_MS = 86_400_000;

interface JoinLeave {
  joins: number;
  leaves: number;
}

function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Percent number (3.2 means 3.2%) — the dashboard formats it with a % suffix. */
function unsubRate(joins: number, leaves: number): number {
  if (joins === 0) return 0;
  return Math.round((leaves / joins) * 100 * 100) / 100;
}

/** Same shape as /api/me channels so both feed the ApiChannel type. */
function toChannelDto(channel: Channel, trackedSubscribers: number) {
  return {
    id: channel.id,
    title: channel.title,
    username: channel.username,
    botStatus: channel.botStatus,
    subscriberCount: channel.memberCount ?? trackedSubscribers,
  };
}

function parseDays(req: NextRequest): number {
  const raw = req.nextUrl.searchParams.get('days') ?? '7';
  if (raw !== '7' && raw !== '30') {
    throw new ApiError(400, 'days must be 7 or 30');
  }
  return Number(raw);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id: channelId } = await ctx.params;
    const channel = await assertChannelAccess(userId, channelId);
    const days = parseDays(req);

    // Period = last N UTC days including today, from UTC midnight.
    const now = new Date();
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    since.setTime(since.getTime() - (days - 1) * DAY_MS);

    const prisma = getPrisma();
    const [events, clickGroups, links] = await Promise.all([
      prisma.memberEvent.findMany({
        where: { channelId, ts: { gte: since } },
        select: { type: true, ts: true, linkId: true },
      }),
      prisma.click.groupBy({
        by: ['linkId'],
        where: { ts: { gte: since }, link: { channelId } },
        _count: { _all: true },
      }),
      prisma.trackedLink.findMany({
        where: { channelId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, label: true, creative: true },
      }),
    ]);

    // Aggregate the raw event log per UTC day and per source link in one pass.
    const byDay = new Map<string, JoinLeave>();
    for (let i = 0; i < days; i++) {
      byDay.set(utcDayKey(new Date(since.getTime() + i * DAY_MS)), { joins: 0, leaves: 0 });
    }
    const byLink = new Map<string | null, JoinLeave>();
    const totals: JoinLeave = { joins: 0, leaves: 0 };

    for (const event of events) {
      const day = byDay.get(utcDayKey(event.ts));
      let source = byLink.get(event.linkId);
      if (!source) {
        source = { joins: 0, leaves: 0 };
        byLink.set(event.linkId, source);
      }
      const field = event.type === EventType.JOIN ? 'joins' : 'leaves';
      totals[field] += 1;
      source[field] += 1;
      if (day) day[field] += 1;
    }

    const clicksByLink = new Map(clickGroups.map((group) => [group.linkId, group._count._all]));
    const organic = byLink.get(null) ?? { joins: 0, leaves: 0 };

    const sources = [
      ...links.map((link) => {
        const stats = byLink.get(link.id) ?? { joins: 0, leaves: 0 };
        return {
          linkId: link.id as string | null,
          label: link.label,
          creative: link.creative,
          clicks: clicksByLink.get(link.id) ?? 0,
          joins: stats.joins,
          leaves: stats.leaves,
          unsubRate: unsubRate(stats.joins, stats.leaves),
        };
      }),
      {
        linkId: null,
        label: 'Organic',
        creative: null,
        clicks: 0,
        joins: organic.joins,
        leaves: organic.leaves,
        unsubRate: unsubRate(organic.joins, organic.leaves),
      },
    ].sort((a, b) => b.joins - a.joins || b.clicks - a.clicks);

    const trackedSubscribers = await getPrisma().subscriber.count({
      where: { channelId: channel.id, leftAt: null },
    });

    return jsonOk({
      channel: toChannelDto(channel, trackedSubscribers),
      totals: {
        joins: totals.joins,
        leaves: totals.leaves,
        net: totals.joins - totals.leaves,
        unsubRate: unsubRate(totals.joins, totals.leaves),
      },
      series: Array.from(byDay, ([date, stats]) => ({ date, ...stats })),
      sources,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
