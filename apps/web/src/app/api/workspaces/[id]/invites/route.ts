import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPrisma, WorkspaceRole } from '@tgpulse/db';
import { getSessionUserId } from '@/server/auth';
import { assertQuota } from '@/server/entitlements';
import { handleRouteError, jsonError, jsonOk, parseOrThrow, readJsonBody, requestOrigin } from '@/server/http';
import { countPendingInvites, createInviteToken, inviteExpiry, toInviteDto } from '@/server/invites';
import { assertCanManageRole } from '@/server/members';
import { assertRole } from '@/server/roles';

export const runtime = 'nodejs';

const createInviteSchema = z.object({
  role: z.enum(WorkspaceRole).default(WorkspaceRole.VIEWER),
});

/** Issue a one-time invite link, valid for INVITE_TTL_DAYS. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id: workspaceId } = await ctx.params;
    const callerRole = await assertRole(userId, workspaceId, WorkspaceRole.ADMIN);

    const body = parseOrThrow(createInviteSchema, await readJsonBody(req));
    // Only an owner may hand out an owner seat.
    assertCanManageRole(callerRole, WorkspaceRole.VIEWER, body.role);

    const prisma = getPrisma();
    const [members, pending] = await Promise.all([
      prisma.membership.count({ where: { workspaceId } }),
      countPendingInvites(workspaceId),
    ]);
    // Pending invites already hold a seat, so they count towards the quota.
    await assertQuota(workspaceId, 'members', members + pending);

    const invite = await prisma.workspaceInvite.create({
      data: {
        workspaceId,
        token: createInviteToken(),
        role: body.role,
        createdById: userId,
        expiresAt: inviteExpiry(),
      },
    });

    return jsonOk(toInviteDto(invite, requestOrigin(req)));
  } catch (error) {
    return handleRouteError(error);
  }
}
