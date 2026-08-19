import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPrisma, WorkspaceRole } from '@tgpulse/db';
import { getSessionUserId } from '@/server/auth';
import { handleRouteError, jsonError, jsonOk, parseOrThrow, readJsonBody } from '@/server/http';
import { assertCanManageRole, assertNotLastOwner, findMemberOrThrow } from '@/server/members';
import { assertRole } from '@/server/roles';

export const runtime = 'nodejs';

const updateMemberSchema = z.object({
  role: z.enum(WorkspaceRole),
});

type RouteParams = { params: Promise<{ id: string; userId: string }> };

/** Change a member's role. Only an owner may create, demote or remove another owner. */
export async function PATCH(req: NextRequest, ctx: RouteParams) {
  try {
    const callerId = await getSessionUserId(req.cookies);
    if (!callerId) return jsonError(401, 'Unauthorized');

    const { id: workspaceId, userId } = await ctx.params;
    const callerRole = await assertRole(callerId, workspaceId, WorkspaceRole.ADMIN);

    const body = parseOrThrow(updateMemberSchema, await readJsonBody(req));
    const member = await findMemberOrThrow(workspaceId, userId);

    if (member.role === body.role) {
      return jsonOk({ userId, role: member.role });
    }
    assertCanManageRole(callerRole, member.role, body.role);

    const updated = await getPrisma().$transaction(async (tx) => {
      // Inside the transaction so two concurrent demotions cannot drain the owner seats.
      await assertNotLastOwner(tx, workspaceId, member.role);
      return tx.membership.update({
        where: { userId_workspaceId: { userId, workspaceId } },
        data: { role: body.role },
        select: { userId: true, role: true },
      });
    });

    return jsonOk(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Remove a member from the workspace. The last owner can never be removed. */
export async function DELETE(req: NextRequest, ctx: RouteParams) {
  try {
    const callerId = await getSessionUserId(req.cookies);
    if (!callerId) return jsonError(401, 'Unauthorized');

    const { id: workspaceId, userId } = await ctx.params;
    const callerRole = await assertRole(callerId, workspaceId, WorkspaceRole.ADMIN);

    const member = await findMemberOrThrow(workspaceId, userId);
    assertCanManageRole(callerRole, member.role);

    await getPrisma().$transaction(async (tx) => {
      await assertNotLastOwner(tx, workspaceId, member.role);
      await tx.membership.delete({ where: { userId_workspaceId: { userId, workspaceId } } });
    });

    return jsonOk({ userId });
  } catch (error) {
    return handleRouteError(error);
  }
}
