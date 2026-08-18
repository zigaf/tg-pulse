import type { NextRequest } from 'next/server';
import { assertApiKeyAccess, revokeApiKey, toApiKeyDto } from '@/server/api-keys';
import { getSessionUserId } from '@/server/auth';
import { handleRouteError, jsonError, jsonOk } from '@/server/http';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id } = await ctx.params;
    const key = await assertApiKeyAccess(userId, id);

    // Idempotent: revoking twice is a no-op.
    const revoked = await revokeApiKey(key.id);

    return jsonOk(toApiKeyDto(revoked));
  } catch (error) {
    return handleRouteError(error);
  }
}
