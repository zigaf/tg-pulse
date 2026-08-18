import { getPrisma, BotStatus, type Channel } from '@tgpulse/db';

const prisma = getPrisma();

/** ACTIVE channels across all workspaces where the Telegram user is a member. */
export async function getUserActiveChannels(tgUserId: number): Promise<Channel[]> {
  const user = await prisma.user.findUnique({ where: { tgId: BigInt(tgUserId) } });
  if (!user) return [];

  return prisma.channel.findMany({
    where: {
      botStatus: BotStatus.ACTIVE,
      workspace: { members: { some: { userId: user.id } } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

/** One ACTIVE channel by id, only if the Telegram user has access to it. */
export async function getUserChannel(tgUserId: number, channelId: string): Promise<Channel | null> {
  const channels = await getUserActiveChannels(tgUserId);
  return channels.find((channel) => channel.id === channelId) ?? null;
}

/** Map of TrackedLink id -> label for the given ids (nulls filtered out by caller). */
export async function resolveLinkLabels(linkIds: string[]): Promise<Map<string, string>> {
  if (linkIds.length === 0) return new Map();
  const links = await prisma.trackedLink.findMany({
    where: { id: { in: linkIds } },
    select: { id: true, label: true },
  });
  return new Map(links.map((l) => [l.id, l.label]));
}
