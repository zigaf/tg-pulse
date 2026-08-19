import { getPrisma, Plan, SubscriptionStatus, type Subscription } from '@tgpulse/db';
import { ApiError } from './http';

/**
 * Plans, limits and feature gates for the web app — the single source of truth.
 * Every number here mirrors docs/BILLING.md; routes must never hardcode their own.
 *
 * Effective plan is derived from the active subscription, not from `Workspace.plan`:
 * that column is a denormalized cache kept in sync by the bot's daily sweep and may
 * lag behind an expiry by up to a day.
 */

/** `null` means unlimited. */
export type Limit = number | null;
export const UNLIMITED = null;

export const PLAN_FEATURES = ['postbacks', 'revenue', 'fraudFull'] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number];

export const QUOTA_KINDS = ['channels', 'linksPerChannel', 'members'] as const;
export type QuotaKind = (typeof QUOTA_KINDS)[number];

export type PlanLimits = Readonly<Record<QuotaKind, Limit>>;
export type PlanFeatures = Readonly<Record<PlanFeature, boolean>>;

export interface PlanDefinition {
  readonly limits: PlanLimits;
  readonly features: PlanFeatures;
}

/** Ascending by capability; drives "is there a better plan to upgrade to". */
export const PLAN_ORDER = [Plan.FREE, Plan.PRO, Plan.AGENCY] as const;

export const PLANS = {
  FREE: {
    limits: { channels: 1, linksPerChannel: 5, members: 1 },
    features: { postbacks: false, revenue: false, fraudFull: false },
  },
  PRO: {
    limits: { channels: 3, linksPerChannel: UNLIMITED, members: 5 },
    features: { postbacks: true, revenue: true, fraudFull: true },
  },
  AGENCY: {
    limits: { channels: 25, linksPerChannel: UNLIMITED, members: 25 },
    features: { postbacks: true, revenue: true, fraudFull: true },
  },
} as const satisfies Record<Plan, PlanDefinition>;

/**
 * CSV export row cap (docs/PHASE7-BUILD.md §3): FREE gets a sample, paid plans are unlimited.
 * Deliberately outside `QUOTA_KINDS` — those keys are the canonical contract shared with the
 * bot and the billing UI, while this cap is a web-only export detail.
 */
export const FREE_EXPORT_ROW_LIMIT = 100;

export function exportRowLimit(plan: Plan): Limit {
  return plan === Plan.FREE ? FREE_EXPORT_ROW_LIMIT : UNLIMITED;
}

const PLAN_LABELS: Record<Plan, string> = {
  FREE: 'Free',
  PRO: 'Pro',
  AGENCY: 'Agency',
};

/** Subject of a gate message; phrased so it reads as a singular noun phrase. */
const FEATURE_LABELS: Record<PlanFeature, string> = {
  postbacks: 'The postbacks module',
  revenue: 'The revenue module',
  fraudFull: 'Full fraud reporting',
};

const QUOTA_NOUNS: Record<QuotaKind, { one: string; many: string }> = {
  channels: { one: 'channel', many: 'channels' },
  linksPerChannel: { one: 'tracked link per channel', many: 'tracked links per channel' },
  members: { one: 'team member', many: 'team members' },
};

// ---------- entitlements ----------

export interface SubscriptionSummary {
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

export interface Entitlements {
  plan: Plan;
  limits: PlanLimits;
  features: PlanFeatures;
  /** The currently *active* subscription only; null on FREE and after expiry. */
  subscription: SubscriptionSummary | null;
}

type ActiveSubscription = Pick<
  Subscription,
  'workspaceId' | 'plan' | 'status' | 'currentPeriodEnd' | 'cancelAtPeriodEnd'
>;

/** Paid access lasts while the row is not EXPIRED and its period has not elapsed. */
async function findActiveSubscriptions(
  workspaceIds: readonly string[],
): Promise<ActiveSubscription[]> {
  if (workspaceIds.length === 0) return [];

  return getPrisma().subscription.findMany({
    where: {
      workspaceId: { in: [...workspaceIds] },
      status: { not: SubscriptionStatus.EXPIRED },
      currentPeriodEnd: { gt: new Date() },
    },
    // Schema keeps one active row per workspace; the longest period wins if that ever breaks.
    orderBy: { currentPeriodEnd: 'desc' },
    select: {
      workspaceId: true,
      plan: true,
      status: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
    },
  });
}

function toEntitlements(subscription: ActiveSubscription | undefined): Entitlements {
  const plan = subscription?.plan ?? Plan.FREE;
  const definition = PLANS[plan];

  return {
    plan,
    limits: definition.limits,
    features: definition.features,
    subscription: subscription
      ? {
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        }
      : null,
  };
}

export async function getEntitlements(workspaceId: string): Promise<Entitlements> {
  const [subscription] = await findActiveSubscriptions([workspaceId]);
  return toEntitlements(subscription);
}

/** Batched variant for list endpoints: one query covers every workspace. */
export async function getEntitlementsLookup(
  workspaceIds: readonly string[],
): Promise<(workspaceId: string) => Entitlements> {
  const rows = await findActiveSubscriptions(workspaceIds);

  const byWorkspace = new Map<string, ActiveSubscription>();
  for (const row of rows) {
    if (!byWorkspace.has(row.workspaceId)) byWorkspace.set(row.workspaceId, row);
  }

  return (workspaceId) => toEntitlements(byWorkspace.get(workspaceId));
}

// ---------- usage ----------

export interface WorkspaceUsage {
  channels: number;
  members: number;
  /** Active (non-revoked) tracked links, keyed by channel id. Revoked links free their slot. */
  linksByChannel: Record<string, number>;
}

export async function getUsage(workspaceId: string): Promise<WorkspaceUsage> {
  const prisma = getPrisma();

  const [channels, members, linkGroups] = await Promise.all([
    prisma.channel.count({ where: { workspaceId } }),
    prisma.membership.count({ where: { workspaceId } }),
    prisma.trackedLink.groupBy({
      by: ['channelId'],
      where: { isRevoked: false, channel: { workspaceId } },
      _count: { _all: true },
    }),
  ]);

  return {
    channels,
    members,
    linksByChannel: Object.fromEntries(
      linkGroups.map((group) => [group.channelId, group._count._all]),
    ),
  };
}

/** Links already counted against a channel's quota — the value to pass to `assertQuota`. */
export async function countChannelLinks(channelId: string): Promise<number> {
  return getPrisma().trackedLink.count({ where: { channelId, isRevoked: false } });
}

// ---------- gates ----------

/** 402 + `upgrade: true` is the contract the dashboard and the bot both key on. */
function upgradeRequired(message: string): ApiError {
  return new ApiError(402, message, { upgrade: true });
}

function featureMessage(feature: PlanFeature): string {
  const label = FEATURE_LABELS[feature];
  const required = PLAN_ORDER.find((plan) => PLANS[plan].features[feature]);
  if (!required) return `${label} is not available on your plan.`;
  return `${label} requires the ${PLAN_LABELS[required]} plan. Upgrade to unlock it.`;
}

function isHigherLimit(candidate: Limit, current: Limit): boolean {
  if (candidate === UNLIMITED) return current !== UNLIMITED;
  if (current === UNLIMITED) return false;
  return candidate > current;
}

function hasHigherLimit(plan: Plan, kind: QuotaKind): boolean {
  const current = PLANS[plan].limits[kind];
  return PLAN_ORDER.slice(PLAN_ORDER.indexOf(plan) + 1).some((candidate) =>
    isHigherLimit(PLANS[candidate].limits[kind], current),
  );
}

function quotaMessage(plan: Plan, kind: QuotaKind, limit: number): string {
  const nouns = QUOTA_NOUNS[kind];
  const tail = hasHigherLimit(plan, kind)
    ? 'Upgrade to add more.'
    : 'Contact support to raise the limit.';
  return `${PLAN_LABELS[plan]} plan allows ${limit} ${limit === 1 ? nouns.one : nouns.many}. ${tail}`;
}

/** Throws 402 when the workspace's plan does not include the feature. */
export async function assertFeature(workspaceId: string, feature: PlanFeature): Promise<void> {
  const { features } = await getEntitlements(workspaceId);
  if (features[feature]) return;
  throw upgradeRequired(featureMessage(feature));
}

/** Feature gate for channel-scoped routes; resolves the owning workspace first. */
export async function assertChannelFeature(
  channelId: string,
  feature: PlanFeature,
): Promise<void> {
  const channel = await getPrisma().channel.findUnique({
    where: { id: channelId },
    select: { workspaceId: true },
  });
  if (!channel) throw new ApiError(404, 'Channel not found');
  await assertFeature(channel.workspaceId, feature);
}

/**
 * Throws 402 when creating one more entity would exceed the plan quota.
 * `currentCount` is what already exists, so the check is `currentCount < limit`.
 */
export async function assertQuota(
  workspaceId: string,
  kind: QuotaKind,
  currentCount: number,
): Promise<void> {
  const { plan, limits } = await getEntitlements(workspaceId);
  const limit = limits[kind];
  if (limit === UNLIMITED || currentCount < limit) return;
  throw upgradeRequired(quotaMessage(plan, kind, limit));
}
