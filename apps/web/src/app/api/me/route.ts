import type { NextRequest } from 'next/server';
import { getPrisma } from '@tgpulse/db';
import { getSessionUser, toUserDto } from '@/server/auth';
import { getEntitlementsLookup } from '@/server/entitlements';
import { handleRouteError, jsonError, jsonOk } from '@/server/http';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req.cookies);
    if (!user) return jsonError(401, 'Unauthorized');

    const memberships = await getPrisma().membership.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      include: {
        workspace: {
          include: {
            channels: {
              orderBy: { createdAt: 'asc' },
              include: {
                _count: { select: { subscribers: { where: { leftAt: null } } } },
              },
            },
          },
        },
      },
    });

    // One extra query for the whole list; lets every screen gate itself without a second request.
    const entitlementsFor = await getEntitlementsLookup(
      memberships.map(({ workspaceId }) => workspaceId),
    );

    const workspaces = memberships.map(({ workspace }) => {
      const { plan, limits, features } = entitlementsFor(workspace.id);
      return {
        id: workspace.id,
        name: workspace.name,
        // Effective plan: an expired subscription reads FREE even before the sweep syncs the column.
        plan,
        entitlements: { limits, features },
        brandName: workspace.brandName,
        brandUrl: workspace.brandUrl,
        channels: workspace.channels.map((channel) => ({
          id: channel.id,
          title: channel.title,
          username: channel.username,
          botStatus: channel.botStatus,
          // Real channel size when synced; falls back to tracked-only count
          subscriberCount: channel.memberCount ?? channel._count.subscribers,
        })),
      };
    });

    return jsonOk({ user: toUserDto(user), workspaces });
  } catch (error) {
    return handleRouteError(error);
  }
}
