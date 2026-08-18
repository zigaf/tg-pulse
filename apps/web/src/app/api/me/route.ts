import type { NextRequest } from 'next/server';
import { getPrisma } from '@tgpulse/db';
import { getSessionUser, toUserDto } from '@/server/auth';
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

    const workspaces = memberships.map(({ workspace }) => ({
      id: workspace.id,
      name: workspace.name,
      plan: workspace.plan,
      channels: workspace.channels.map((channel) => ({
        id: channel.id,
        title: channel.title,
        username: channel.username,
        botStatus: channel.botStatus,
        // Real channel size when synced; falls back to tracked-only count
        subscriberCount: channel.memberCount ?? channel._count.subscribers,
      })),
    }));

    return jsonOk({ user: toUserDto(user), workspaces });
  } catch (error) {
    return handleRouteError(error);
  }
}
