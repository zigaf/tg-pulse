import type { NextRequest } from 'next/server';
import { getPrisma } from '@tgpulse/db';
import { getSessionUserId } from '@/server/auth';
import { ApiError, handleRouteError, jsonError, jsonOk } from '@/server/http';
import { findAcceptableInviteOrThrow } from '@/server/invites';
import { getRole } from '@/server/roles';

export const runtime = 'nodejs';

/**
 * Join a workspace through an invite link. The dynamic segment is the invite *token*
 * (the segment is named `id` only because Next.js requires one slug name per path level).
 *
 * Spent or expired tokens answer 410. A user who is already a member gets a plain 200 and
 * keeps their current role — re-opening the link must not duplicate or downgrade them.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id: token } = await ctx.params;
    const invite = await findAcceptableInviteOrThrow(token);

    const [existingRole, workspace] = await Promise.all([
      getRole(userId, invite.workspaceId),
      getPrisma().workspace.findUnique({
        where: { id: invite.workspaceId },
        select: { name: true },
      }),
    ]);
    const workspaceName = workspace?.name ?? null;

    if (existingRole) {
      // The invite stays usable for whoever it was actually meant for.
      return jsonOk({
        workspaceId: invite.workspaceId,
        workspaceName,
        role: existingRole,
        alreadyMember: true,
      });
    }

    const now = new Date();
    const membership = await getPrisma().$transaction(async (tx) => {
      // Claim first: concurrent accepts race on this update, and only one can win.
      const claimed = await tx.workspaceInvite.updateMany({
        where: { id: invite.id, acceptedAt: null, expiresAt: { gt: now } },
        data: { acceptedAt: now, acceptedById: userId },
      });
      if (claimed.count === 0) {
        throw new ApiError(410, 'This invite link is no longer valid');
      }

      return tx.membership.create({
        data: { userId, workspaceId: invite.workspaceId, role: invite.role },
        select: { workspaceId: true, role: true },
      });
    });

    return jsonOk({ ...membership, workspaceName, alreadyMember: false });
  } catch (error) {
    return handleRouteError(error);
  }
}
