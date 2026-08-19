import type { NextRequest } from 'next/server';
import { getPrisma } from '@tgpulse/db';
import { getSessionUserId } from '@/server/auth';
import { ApiError, handleRouteError, jsonError, jsonOk } from '@/server/http';
import { assertCanMutateWorkspace } from '@/server/roles';
import { revokeChatInviteLink } from '@/server/telegram';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id } = await ctx.params;
    const prisma = getPrisma();

    const link = await prisma.trackedLink.findUnique({
      where: { id },
      include: { channel: true },
    });
    if (!link) throw new ApiError(404, 'Link not found');

    // Membership *and* role: revoking is a mutation, so viewers are turned away.
    await assertCanMutateWorkspace(userId, link.channel.workspaceId);

    // Idempotent: an already revoked link is left as is.
    if (!link.isRevoked) {
      if (link.inviteLink) {
        await revokeChatInviteLink(link.channel.tgChatId, link.inviteLink);
      }
      await prisma.trackedLink.update({ where: { id: link.id }, data: { isRevoked: true } });
    }

    return jsonOk({ id: link.id, isRevoked: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
