import type { NextRequest } from 'next/server';
import { getPrisma } from '@tgpulse/db';
import { getSessionUserId } from '@/server/auth';
import { ApiError, handleRouteError, jsonError, jsonOk } from '@/server/http';
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

    const membership = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: link.channel.workspaceId } },
    });
    if (!membership) throw new ApiError(403, 'No access to this link');

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
