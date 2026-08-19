import type { NextRequest } from 'next/server';
import { getPrisma } from '@tgpulse/db';
import { assertChannelAccess } from '@/server/access';
import { generateChannelApiKey, toApiKeyDto } from '@/server/api-keys';
import { getSessionUserId } from '@/server/auth';
import { assertFeature } from '@/server/entitlements';
import { handleRouteError, jsonError, jsonOk } from '@/server/http';
import { assertCanMutateChannel } from '@/server/roles';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id: channelId } = await ctx.params;
    await assertChannelAccess(userId, channelId);

    const keys = await getPrisma().channelApiKey.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
    });

    return jsonOk(keys.map(toApiKeyDto));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id: channelId } = await ctx.params;
    const channel = await assertCanMutateChannel(userId, channelId);
    // Listing (GET) stays open so a downgraded workspace can still revoke leftover keys.
    await assertFeature(channel.workspaceId, 'revenue');

    const { raw, key } = await generateChannelApiKey(channelId);

    // `key` is the only time the raw secret is ever returned.
    return jsonOk({ ...toApiKeyDto(key), key: raw });
  } catch (error) {
    return handleRouteError(error);
  }
}
