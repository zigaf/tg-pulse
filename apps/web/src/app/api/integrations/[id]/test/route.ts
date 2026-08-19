import type { NextRequest } from 'next/server';
import { getPrisma } from '@tgpulse/db';
import { getSessionUserId } from '@/server/auth';
import { assertChannelFeature } from '@/server/entitlements';
import { handleRouteError, jsonError, jsonOk } from '@/server/http';
import { runIntegrationTest } from '@/server/integration-test';
import { assertIntegrationAccess } from '@/server/integrations';
import { assertCanMutateChannel } from '@/server/roles';

export const runtime = 'nodejs';

/**
 * Run the platform's own verification call and report what it said.
 * A refusal by the platform is a valid answer, not a server error, so it comes back as
 * 200 with `{ ok: false, detail }` and is rendered as text next to the connection.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id } = await ctx.params;
    const integration = await assertIntegrationAccess(userId, id);
    // Sending a request with the workspace's credentials is a side effect, not a read.
    await assertCanMutateChannel(userId, integration.channelId);
    await assertChannelFeature(integration.channelId, 'postbacks');

    const result = await runIntegrationTest(integration);

    // The test is the freshest signal we have, so the health block reflects it.
    // `lastSyncAt` stays untouched: it means "last delivered conversion", not "last test".
    await getPrisma().adIntegration.update({
      where: { id: integration.id },
      data: {
        lastStatus: result.ok ? 'TEST_OK' : 'TEST_FAILED',
        lastError: result.ok ? null : result.detail,
      },
    });

    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
