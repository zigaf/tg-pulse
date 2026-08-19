/**
 * Plan catalog and quota helpers for the billing UI.
 *
 * Numbers mirror docs/BILLING.md, the single source of truth. The catalog is only used to
 * describe plans the workspace is *not* on: whatever the server reports for the current plan
 * (limits/features from GET /api/workspaces/[id]/billing) always wins on screen.
 */

import type { BillingData, Entitlements, Plan, PlanFeatures, PlanLimits } from './api';
import { BOT_USERNAME, formatNumber } from './format';

export const PLAN_ORDER: readonly Plan[] = ['FREE', 'PRO', 'AGENCY'];

const PLAN_LABELS: Record<Plan, string> = { FREE: 'Free', PRO: 'Pro', AGENCY: 'Agency' };

export function planLabel(plan: Plan): string {
  return PLAN_LABELS[plan] ?? PLAN_LABELS.FREE;
}

/** Server strings are trusted but not assumed: anything unknown reads as Free. */
export function normalizePlan(value: string | null | undefined): Plan {
  const upper = (value ?? '').toUpperCase() as Plan;
  return PLAN_ORDER.includes(upper) ? upper : 'FREE';
}

/** Rank inside PLAN_ORDER, used to decide whether a plan is an upgrade or a downgrade. */
export function planRank(plan: Plan): number {
  return PLAN_ORDER.indexOf(plan);
}

export interface PlanCatalogEntry {
  plan: Plan;
  label: string;
  /** Telegram Stars (XTR) per 30 days. */
  priceStars: number;
  /** Human hint next to the price, e.g. the rough USD equivalent. */
  priceHint: string;
  tagline: string;
  limits: PlanLimits;
  features: PlanFeatures;
}

export const PLAN_CATALOG: Record<Plan, PlanCatalogEntry> = {
  FREE: {
    plan: 'FREE',
    label: 'Free',
    priceStars: 0,
    priceHint: 'forever',
    tagline: 'One channel, full attribution.',
    limits: { channels: 1, linksPerChannel: 5, members: 1 },
    features: { postbacks: false, revenue: false, fraudFull: false },
  },
  PRO: {
    plan: 'PRO',
    label: 'Pro',
    priceStars: 1000,
    priceHint: 'about $19 per 30 days',
    tagline: 'For buyers running paid traffic every week.',
    limits: { channels: 3, linksPerChannel: null, members: 5 },
    features: { postbacks: true, revenue: true, fraudFull: true },
  },
  AGENCY: {
    plan: 'AGENCY',
    label: 'Agency',
    priceStars: 4000,
    priceHint: 'about $79 per 30 days',
    tagline: 'For teams running many client channels.',
    limits: { channels: 25, linksPerChannel: null, members: 25 },
    features: { postbacks: true, revenue: true, fraudFull: true },
  },
};

/* ---------- quotas ---------- */

/** Normalizes a limit into a finite cap or null for "unlimited". */
export function toQuota(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

export function formatQuota(value: number | null | undefined): string {
  const quota = toQuota(value);
  return quota === null ? 'Unlimited' : formatNumber(quota);
}

/** 0 to 1, clamped. Unlimited quotas never fill the bar. */
export function quotaRatio(used: number, limit: number | null | undefined): number {
  const quota = toQuota(limit);
  if (quota === null || quota === 0) return 0;
  return Math.min(1, Math.max(0, used / quota));
}

export function isQuotaFull(used: number, limit: number | null | undefined): boolean {
  const quota = toQuota(limit);
  return quota !== null && used >= quota;
}

/* ---------- feature rows ---------- */

export interface PlanFeatureRow {
  label: string;
  included: boolean;
}

function countLabel(value: number | null | undefined, singular: string, plural: string): string {
  const quota = toQuota(value);
  if (quota === null) return `Unlimited ${plural}`;
  return `${formatNumber(quota)} ${quota === 1 ? singular : plural}`;
}

/** One list per plan card: quotas first, then the switches that actually differ. */
export function planFeatureRows(limits: PlanLimits, features: PlanFeatures): PlanFeatureRow[] {
  return [
    { label: countLabel(limits.channels, 'channel', 'channels'), included: true },
    { label: `${countLabel(limits.linksPerChannel, 'tracking link', 'tracking links')} per channel`, included: true },
    { label: countLabel(limits.members, 'team member', 'team members'), included: true },
    { label: 'Attribution, joins and leaves, daily report', included: true },
    { label: 'Landing pixel and instant alerts', included: true },
    { label: 'Conversion postbacks', included: features.postbacks === true },
    { label: 'Revenue and ROMI module', included: features.revenue === true },
    { label: 'Full fraud reports', included: features.fraudFull === true },
  ];
}

/* ---------- payload normalization ---------- */

/**
 * The billing payload crosses an app boundary, so nothing in it is assumed to be present.
 * Missing pieces fall back to the catalog entry for the reported plan.
 */
export function normalizeBilling(data: BillingData): BillingData {
  const plan = normalizePlan(data.plan);
  const catalog = PLAN_CATALOG[plan];
  return {
    plan,
    limits: data.limits ?? catalog.limits,
    features: data.features ?? catalog.features,
    usage: {
      channels: data.usage?.channels ?? 0,
      members: data.usage?.members ?? 0,
      linksByChannel: data.usage?.linksByChannel ?? {},
    },
    subscription: data.subscription ?? null,
    payments: Array.isArray(data.payments) ? data.payments : [],
  };
}

/* ---------- gates ---------- */

export type GatedFeature = 'postbacks' | 'revenue' | 'fraudFull';

/**
 * Client-side hint only: the API is the authority and answers 402 on a real gate hit.
 * Missing entitlements mean the server has not told us yet, so nothing gets locked.
 */
export function isFeatureLocked(entitlements: Entitlements | undefined, feature: GatedFeature): boolean {
  if (!entitlements?.features) return false;
  return entitlements.features[feature] === false;
}

/* ---------- upgrade deep link ---------- */

/** Stars checkout lives in the bot, so the web app only deep-links into it. */
export function upgradeUrl(workspaceId: string): string {
  return `https://t.me/${BOT_USERNAME}?start=upgrade_${workspaceId}`;
}
