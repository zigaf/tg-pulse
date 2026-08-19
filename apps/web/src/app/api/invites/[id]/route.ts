import type { NextRequest } from 'next/server';
import { getPrisma, WorkspaceRole } from '@tgpulse/db';
import { getSessionUserId } from '@/server/auth';
import { handleRouteError, jsonError, jsonOk } from '@/server/http';
import { findAcceptableInviteOrThrow, findInviteOrThrow } from '@/server/invites';
import { assertCanManageRole } from '@/server/members';
import { assertRole } from '@/server/roles';

export const runtime = 'nodejs';

/**
 * Preview an invite before accepting it, so the landing page can name the workspace.
 *
 * The segment is read as the *token* here (holding the token is the only credential the
 * link has); DELETE below reads it as the invite id. Next.js allows one slug name per
 * dynamic path level, hence the shared `[id]`.
 *
 * Public on purpose: the invitee may still have to sign in. Nothing beyond the workspace
 * name, the offered role and the expiry is exposed.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: token } = await ctx.params;
    const invite = await findAcceptableInviteOrThrow(token);

    const workspace = await getPrisma().workspace.findUnique({
      where: { id: invite.workspaceId },
      select: { name: true },
    });

    return jsonOk({
      workspaceName: workspace?.name ?? null,
      role: invite.role,
      expiresAt: invite.expiresAt,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Revoke a pending invite; `id` is the invite id. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id } = await ctx.params;
    const invite = await findInviteOrThrow(id);

    const callerRole = await assertRole(userId, invite.workspaceId, WorkspaceRole.ADMIN);
    // An admin must not be able to cancel an owner seat handed out by an owner.
    assertCanManageRole(callerRole, WorkspaceRole.VIEWER, invite.role);

    // Deleting frees the seat it was holding against the members quota.
    await getPrisma().workspaceInvite.delete({ where: { id: invite.id } });

    return jsonOk({ id: invite.id });
  } catch (error) {
    return handleRouteError(error);
  }
}
