import { getPrisma, BotStatus, type Channel, type Plan } from '@tgpulse/db';
import { getEntitlements, isWithinQuota, type Entitlements } from './billing';

/**
 * Quota accounting on top of the plan limits: how much of a workspace is used and
 * whether one more channel or link still fits. Enforcement happens at creation time.
 */

const prisma = getPrisma();

/** A channel counts against the quota until the bot is removed from it. */
const COUNTED_CHANNEL = { botStatus: { not: BotStatus.REMOVED } };

export interface QuotaUsage {
  channels: number;
  /** Links of the busiest channel: the per-channel limit bites there first. */
  maxLinksInChannel: number;
  members: number;
}

export async function countChannelLinks(channelId: string): Promise<number> {
  return prisma.trackedLink.count({ where: { channelId, isRevoked: false } });
}

export async function getWorkspaceUsage(workspaceId: string): Promise<QuotaUsage> {
  const [channels, members] = await Promise.all([
    prisma.channel.findMany({ where: { workspaceId, ...COUNTED_CHANNEL }, select: { id: true } }),
    prisma.membership.count({ where: { workspaceId } }),
  ]);

  // One grouped count instead of a query per channel: the card only needs the peak.
  const linkCounts = await prisma.trackedLink.groupBy({
    by: ['channelId'],
    where: { channelId: { in: channels.map((channel) => channel.id) }, isRevoked: false },
    _count: { _all: true },
  });

  return {
    channels: channels.length,
    maxLinksInChannel: Math.max(0, ...linkCounts.map((row) => row._count._all)),
    members,
  };
}

/**
 * Channels are ranked oldest first, so a downgrade leaves the earliest ones writable
 * and pushes the newest over the edge. Nothing is deleted, they just go read-only.
 */
export async function isChannelOverQuota(channel: Channel, entitlements: Entitlements): Promise<boolean> {
  const rank = await prisma.channel.count({
    where: {
      workspaceId: channel.workspaceId,
      ...COUNTED_CHANNEL,
      createdAt: { lte: channel.createdAt },
    },
  });
  return rank > entitlements.limits.channels;
}

/** Gate results carry the plan that blocked them, so the upsell card needs no second read. */
export type LinkGate =
  | { allowed: true }
  | { allowed: false; plan: Plan; reason: 'channels' | 'links'; limit: number };

export type FeatureGate = { allowed: true } | { allowed: false; plan: Plan };

/** Everything the /newlink flow needs to decide whether one more link is allowed. */
export async function checkLinkQuota(channel: Channel): Promise<LinkGate> {
  const entitlements = await getEntitlements(channel.workspaceId);
  const { plan } = entitlements;

  if (await isChannelOverQuota(channel, entitlements)) {
    return { allowed: false, plan, reason: 'channels', limit: entitlements.limits.channels };
  }

  const { linksPerChannel } = entitlements.limits;
  if (linksPerChannel === null) return { allowed: true };

  const used = await countChannelLinks(channel.id);
  return isWithinQuota(used, linksPerChannel)
    ? { allowed: true }
    : { allowed: false, plan, reason: 'links', limit: linksPerChannel };
}

/** A batch also needs to know how much room is left, not only whether one link fits. */
export type BulkLinkGate =
  | Extract<LinkGate, { allowed: false }>
  | {
      allowed: true;
      plan: Plan;
      /** Per-channel link limit of the plan, null when unlimited. */
      limit: number | null;
      /** How many more links fit right now, null when unlimited. */
      remaining: number | null;
    };

/** Everything the /bulklinks flow needs: the same gate plus the room left in it. */
export async function checkBulkLinkQuota(channel: Channel): Promise<BulkLinkGate> {
  const gate = await checkLinkQuota(channel);
  if (!gate.allowed) return gate;

  const entitlements = await getEntitlements(channel.workspaceId);
  const { linksPerChannel } = entitlements.limits;
  if (linksPerChannel === null) {
    return { allowed: true, plan: entitlements.plan, limit: null, remaining: null };
  }

  const used = await countChannelLinks(channel.id);
  return {
    allowed: true,
    plan: entitlements.plan,
    limit: linksPerChannel,
    remaining: Math.max(0, linksPerChannel - used),
  };
}

/**
 * FREE keeps the full fraud report for the newest link of a channel; older ones are gated.
 * Paid plans see every report.
 */
export async function checkFraudReportAccess(channel: Channel, linkId: string): Promise<FeatureGate> {
  const entitlements = await getEntitlements(channel.workspaceId);
  if (entitlements.features.fraudFull) return { allowed: true };

  const newest = await prisma.trackedLink.findFirst({
    where: { channelId: channel.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  return newest?.id === linkId ? { allowed: true } : { allowed: false, plan: entitlements.plan };
}
