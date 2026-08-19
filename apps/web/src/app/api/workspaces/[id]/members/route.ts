import type { NextRequest } from 'next/server';
import { getPrisma } from '@tgpulse/db';
import { assertWorkspaceAccess } from '@/server/access';
import { getSessionUserId } from '@/server/auth';
import { getEntitlements } from '@/server/entitlements';
import { handleRouteError, jsonError, jsonOk, requestOrigin } from '@/server/http';
import { findPendingInvites, toInviteDto } from '@/server/invites';
import { toMemberDto } from '@/server/members';
import { getRole } from '@/server/roles';

export const runtime = 'nodejs';

/** Roster of the workspace: current members plus invites nobody has redeemed yet. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id: workspaceId } = await ctx.params;
    await assertWorkspaceAccess(userId, workspaceId);

    const [members, invites, role, entitlements] = await Promise.all([
      getPrisma().membership.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'asc' },
        select: {
          userId: true,
          role: true,
          createdAt: true,
          user: {
            select: {
              tgId: true,
              username: true,
              firstName: true,
              lastName: true,
              photoUrl: true,
            },
          },
        },
      }),
      findPendingInvites(workspaceId),
      getRole(userId, workspaceId),
      getEntitlements(workspaceId),
    ]);

    const origin = requestOrigin(req);

    return jsonOk({
      // Lets the UI hide actions the caller may not perform without a second request.
      role,
      // Seat quota of the plan; pending invites are already counted against it.
      limit: entitlements.limits.members,
      members: members.map(toMemberDto),
      invites: invites.map((invite) => toInviteDto(invite, origin)),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
