import type { NextRequest } from 'next/server';
import { assertChannelAccess } from '@/server/access';
import { getSessionUserId } from '@/server/auth';
import { handleRouteError, jsonError, jsonOk } from '@/server/http';
import { getChannelIntegrationHealth, HEALTH_WINDOW_DAYS } from '@/server/integrations';

export const runtime = 'nodejs';

/**
 * Delivery health per integration: what the worker last reported, plus the outbox counters
 * over the health window. Read-only, so VIEWER sees it too and no plan gate applies.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id: channelId } = await ctx.params;
    await assertChannelAccess(userId, channelId);

    const items = await getChannelIntegrationHealth(channelId);

    return jsonOk({ windowDays: HEALTH_WINDOW_DAYS, items });
  } catch (error) {
    return handleRouteError(error);
  }
}
