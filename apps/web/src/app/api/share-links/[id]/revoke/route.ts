import type { NextRequest } from 'next/server';
import { getPrisma } from '@tgpulse/db';
import { getSessionUserId } from '@/server/auth';
import { handleRouteError, jsonError, jsonOk, requestOrigin } from '@/server/http';
import { assertCanMutateChannel } from '@/server/roles';
import { findShareLinkOrThrow, toShareLinkDto } from '@/server/share-links';

export const runtime = 'nodejs';

/** Kill a public report link. Idempotent: revoking twice keeps the first timestamp. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id } = await ctx.params;
    const link = await findShareLinkOrThrow(id);
    await assertCanMutateChannel(userId, link.channelId);

    const revoked = link.revokedAt
      ? link
      : await getPrisma().shareLink.update({
          where: { id: link.id },
          data: { revokedAt: new Date() },
        });

    return jsonOk(toShareLinkDto(revoked, requestOrigin(req)));
  } catch (error) {
    return handleRouteError(error);
  }
}
