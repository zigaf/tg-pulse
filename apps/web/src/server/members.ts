import { getPrisma, WorkspaceRole, type Prisma, type User } from '@tgpulse/db';
import { ApiError } from './http';
import { roleLabel } from './roles';

/**
 * Membership management rules (docs/PHASE7-BUILD.md §1).
 *
 * ADMIN may manage viewers and other admins; only an OWNER may promote to, demote
 * or remove an OWNER. A workspace must always keep at least one OWNER.
 */

/** Prisma client or transaction client — the guards run inside transactions. */
type Db = Prisma.TransactionClient | ReturnType<typeof getPrisma>;

export interface MembershipWithUser {
  userId: string;
  role: WorkspaceRole;
  createdAt: Date;
  user: Pick<User, 'tgId' | 'username' | 'firstName' | 'lastName' | 'photoUrl'>;
}

/** API-safe member shape: flat, as the members table renders it (BigInt tgId as string). */
export function toMemberDto(membership: MembershipWithUser) {
  return {
    userId: membership.userId,
    role: membership.role,
    joinedAt: membership.createdAt,
    tgId: membership.user.tgId.toString(),
    username: membership.user.username,
    firstName: membership.user.firstName,
    lastName: membership.user.lastName,
    photoUrl: membership.user.photoUrl,
  };
}

/** Load a membership or throw 404. */
export async function findMemberOrThrow(
  workspaceId: string,
  userId: string,
): Promise<{ userId: string; workspaceId: string; role: WorkspaceRole }> {
  const membership = await getPrisma().membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { userId: true, workspaceId: true, role: true },
  });
  if (!membership) {
    throw new ApiError(404, 'Member not found');
  }
  return membership;
}

/**
 * Only an OWNER may touch an owner seat — either the target is already an OWNER,
 * or the change would create one.
 */
export function assertCanManageRole(
  callerRole: WorkspaceRole,
  targetRole: WorkspaceRole,
  nextRole?: WorkspaceRole,
): void {
  if (callerRole === WorkspaceRole.OWNER) return;
  if (targetRole === WorkspaceRole.OWNER || nextRole === WorkspaceRole.OWNER) {
    throw new ApiError(403, `Only an ${roleLabel(WorkspaceRole.OWNER)} can manage owners`);
  }
}

/**
 * Refuse to demote or remove the last OWNER. Runs inside the mutating transaction so
 * two concurrent demotions cannot both see a second owner.
 */
export async function assertNotLastOwner(
  db: Db,
  workspaceId: string,
  targetRole: WorkspaceRole,
): Promise<void> {
  if (targetRole !== WorkspaceRole.OWNER) return;

  const owners = await db.membership.count({
    where: { workspaceId, role: WorkspaceRole.OWNER },
  });
  if (owners <= 1) {
    throw new ApiError(409, 'Workspace must keep at least one owner');
  }
}
