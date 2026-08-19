import { getPrisma, type Channel, type Workspace } from '@tgpulse/db';
import { ApiError } from './http';

/**
 * Ensure the user is a member of the workspace.
 * Throws 404 for unknown workspaces, 403 for foreign ones. Returns the workspace.
 */
export async function assertWorkspaceAccess(
  userId: string,
  workspaceId: string,
): Promise<Workspace> {
  const prisma = getPrisma();

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) {
    throw new ApiError(404, 'Workspace not found');
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ApiError(403, 'No access to this workspace');
  }

  return workspace;
}

/**
 * Ensure the user is a member of the workspace owning the channel.
 * Throws 404 for unknown channels, 403 for foreign ones. Returns the channel.
 */
export async function assertChannelAccess(userId: string, channelId: string): Promise<Channel> {
  const prisma = getPrisma();

  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) {
    throw new ApiError(404, 'Channel not found');
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: channel.workspaceId } },
  });
  if (!membership) {
    throw new ApiError(403, 'No access to this channel');
  }

  return channel;
}
