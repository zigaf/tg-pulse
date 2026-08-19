import type { NextRequest } from 'next/server';
import { assertChannelAccess } from '@/server/access';
import { getSessionUserId } from '@/server/auth';
import { assertFeature } from '@/server/entitlements';
import { handleRouteError, jsonError, jsonOk } from '@/server/http';
import { buildRevenueReport, parseRevenueDays } from '@/server/revenue';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id: channelId } = await ctx.params;
    const channel = await assertChannelAccess(userId, channelId);
    await assertFeature(channel.workspaceId, 'revenue');

    const days = parseRevenueDays(req.nextUrl.searchParams.get('days'));
    const report = await buildRevenueReport(channelId, days);

    return jsonOk(report);
  } catch (error) {
    return handleRouteError(error);
  }
}
