import type { NextRequest } from 'next/server';
import { assertChannelAccess } from '@/server/access';
import { parseDaysParam } from '@/server/analytics';
import { getSessionUserId } from '@/server/auth';
import { buildContentReport, CONTENT_PERIODS } from '@/server/content';
import { handleRouteError, jsonError, jsonOk } from '@/server/http';

export const runtime = 'nodejs';

/** Post performance and join cohorts; available on every plan (docs/CONTENT.md). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id: channelId } = await ctx.params;
    await assertChannelAccess(userId, channelId);

    const days = parseDaysParam(req.nextUrl.searchParams.get('days'), CONTENT_PERIODS);
    return jsonOk(await buildContentReport(channelId, days));
  } catch (error) {
    return handleRouteError(error);
  }
}
