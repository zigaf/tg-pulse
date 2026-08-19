import type { NextRequest } from 'next/server';
import { assertChannelAccess } from '@/server/access';
import { REPORT_PERIODS, parseDaysParam } from '@/server/analytics';
import { getSessionUserId } from '@/server/auth';
import { buildBuyerComparison } from '@/server/buyers';
import { getEntitlements } from '@/server/entitlements';
import { handleRouteError, jsonError, jsonOk } from '@/server/http';

export const runtime = 'nodejs';

/**
 * Buyer comparison (docs/PHASE7-BUILD.md §4).
 *
 * Open to every member: it is a read of the same attribution data the overview shows.
 * The revenue column is folded in only when the workspace has the revenue module, so a
 * FREE workspace gets the traffic columns instead of a 402.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id: channelId } = await ctx.params;
    const channel = await assertChannelAccess(userId, channelId);

    const days = parseDaysParam(req.nextUrl.searchParams.get('days'), REPORT_PERIODS);
    const { features } = await getEntitlements(channel.workspaceId);

    const comparison = await buildBuyerComparison(channelId, days, features.revenue);

    return jsonOk(comparison);
  } catch (error) {
    return handleRouteError(error);
  }
}
