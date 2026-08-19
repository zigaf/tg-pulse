import type { NextRequest } from 'next/server';
import { getPrisma, type Channel } from '@tgpulse/db';
import { assertChannelAccess } from '@/server/access';
import { OVERVIEW_PERIODS, buildChannelReport, parseDaysParam } from '@/server/analytics';
import { getSessionUserId } from '@/server/auth';
import { handleRouteError, jsonError, jsonOk } from '@/server/http';

export const runtime = 'nodejs';

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

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id: channelId } = await ctx.params;
    const channel = await assertChannelAccess(userId, channelId);
    const days = parseDaysParam(req.nextUrl.searchParams.get('days'), OVERVIEW_PERIODS);

    // Aggregation lives in @/server/analytics so the public share report cannot drift from it.
    const [report, trackedSubscribers] = await Promise.all([
      buildChannelReport(channelId, days),
      getPrisma().subscriber.count({ where: { channelId: channel.id, leftAt: null } }),
    ]);

    return jsonOk({
      channel: toChannelDto(channel, trackedSubscribers),
      totals: report.totals,
      series: report.series,
      sources: report.sources,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
