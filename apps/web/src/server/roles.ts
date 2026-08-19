import { getPrisma, WorkspaceRole, type Channel } from '@tgpulse/db';
import { assertChannelAccess } from './access';
import { ApiError } from './http';

/**
 * Workspace roles (docs/PHASE7-BUILD.md §1).
 *
 * OWNER  — billing, workspace deletion, owner management.
 * ADMIN  — everything except billing and touching owners.
 * VIEWER — read-only: no link creation, no postbacks, no key management.
 *
 * Read access is still `assertWorkspaceAccess` / `assertChannelAccess`; this module
 * only adds the "may this member mutate" layer on top of it.
 */

/** Ascending by capability. */
export const ROLE_ORDER = [WorkspaceRole.VIEWER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER] as const;

const ROLE_RANK: Record<WorkspaceRole, number> = {
  VIEWER: 0,
  ADMIN: 1,
  OWNER: 2,
};

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  VIEWER: 'Viewer',
  ADMIN: 'Admin',
  OWNER: 'Owner',
};

export function roleLabel(role: WorkspaceRole): string {
  return ROLE_LABELS[role];
}

/** True when `role` is at least as capable as `minRole`. */
export function hasRole(role: WorkspaceRole, minRole: WorkspaceRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}

/** The caller's role in the workspace, or null when they are not a member. */
export async function getRole(userId: string, workspaceId: string): Promise<WorkspaceRole | null> {
  const membership = await getPrisma().membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { role: true },
  });
  return membership?.role ?? null;
}

/**
 * Ensure the caller is a member of the workspace with at least `minRole`.
 * Throws 403 for non-members and for insufficient roles. Returns the actual role.
 */
export async function assertRole(
  userId: string,
  workspaceId: string,
  minRole: WorkspaceRole,
): Promise<WorkspaceRole> {
  const role = await getRole(userId, workspaceId);
  if (!role) {
    throw new ApiError(403, 'No access to this workspace');
  }
  if (!hasRole(role, minRole)) {
    throw new ApiError(403, `Requires the ${roleLabel(minRole)} role`);
  }
  return role;
}

/**
 * Write gate: the caller must be ADMIN or OWNER of the workspace.
 * VIEWER gets 403 "Read-only access" so the UI can say exactly why.
 */
export async function assertCanMutateWorkspace(
  userId: string,
  workspaceId: string,
): Promise<WorkspaceRole> {
  const role = await getRole(userId, workspaceId);
  if (!role) {
    throw new ApiError(403, 'No access to this workspace');
  }
  if (!hasRole(role, WorkspaceRole.ADMIN)) {
    throw new ApiError(403, 'Read-only access');
  }
  return role;
}

/**
 * Gate for every mutating channel route. Returns the channel, so it drops straight in
 * where a route already called `assertChannelAccess`.
 */
export async function assertCanMutateChannel(userId: string, channelId: string): Promise<Channel> {
  const channel = await assertChannelAccess(userId, channelId);
  await assertCanMutateWorkspace(userId, channel.workspaceId);
  return channel;
}
