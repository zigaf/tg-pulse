import { getPrisma, PaymentProvider, Plan, SubscriptionStatus, type Subscription } from '@tgpulse/db';

/**
 * Billing core: the single source of prices, quotas and feature flags inside the bot,
 * plus the write path of a Telegram Stars payment. No UI and no i18n lives here.
 * Numbers follow docs/BILLING.md; nothing outside this file may hardcode them.
 */

const prisma = getPrisma();

/** A quota with no ceiling. Kept as null so every real limit stays an integer. */
export const UNLIMITED = null;
export type Quota = number | typeof UNLIMITED;

export interface PlanLimits {
  channels: number;
  linksPerChannel: Quota;
  members: number;
}

export interface PlanFeatures {
  postbacks: boolean;
  revenue: boolean;
  /** FREE sees the full fraud report for the newest link only. */
  fraudFull: boolean;
}

export interface PlanDefinition {
  plan: Plan;
  /** Whole Telegram Stars. Stars have no minor units, so this is the exact charge. */
  priceXtr: number;
  /** Length of one paid period. Zero for FREE, which never expires. */
  periodDays: number;
  limits: PlanLimits;
  features: PlanFeatures;
}

const BILLING_PERIOD_DAYS = 30;
const SECONDS_PER_DAY = 24 * 60 * 60;
const MS_PER_DAY = SECONDS_PER_DAY * 1000;

/** Currency code Telegram uses for Stars. */
export const STARS_CURRENCY = 'XTR';
/** Telegram accepts exactly this value for recurring Stars invoices. */
export const SUBSCRIPTION_PERIOD_SECONDS = BILLING_PERIOD_DAYS * SECONDS_PER_DAY;

export const PLANS: Record<Plan, PlanDefinition> = {
  [Plan.FREE]: {
    plan: Plan.FREE,
    priceXtr: 0,
    periodDays: 0,
    limits: { channels: 1, linksPerChannel: 5, members: 1 },
    features: { postbacks: false, revenue: false, fraudFull: false },
  },
  [Plan.PRO]: {
    plan: Plan.PRO,
    priceXtr: 1000,
    periodDays: BILLING_PERIOD_DAYS,
    limits: { channels: 3, linksPerChannel: UNLIMITED, members: 5 },
    features: { postbacks: true, revenue: true, fraudFull: true },
  },
  [Plan.AGENCY]: {
    plan: Plan.AGENCY,
    priceXtr: 4000,
    periodDays: BILLING_PERIOD_DAYS,
    limits: { channels: 25, linksPerChannel: UNLIMITED, members: 25 },
    features: { postbacks: true, revenue: true, fraudFull: true },
  },
};

/** Plans a user can actually buy, in upgrade order. */
export const PAID_PLANS = [Plan.PRO, Plan.AGENCY] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

export function isPaidPlan(value: string): value is PaidPlan {
  return (PAID_PLANS as readonly string[]).includes(value);
}

/** The plan to offer when the current one runs out of room. The top plan offers itself. */
export function nextPaidPlan(plan: Plan): PaidPlan {
  const index = PAID_PLANS.indexOf(plan as PaidPlan);
  return PAID_PLANS[Math.min(index + 1, PAID_PLANS.length - 1)];
}

// ---------- Entitlements ----------

export interface Entitlements {
  plan: Plan;
  limits: PlanLimits;
  features: PlanFeatures;
  /** The row that grants the paid plan, or null when the workspace is on FREE. */
  subscription: Subscription | null;
}

/** The live subscription of a workspace: not expired and still inside its period. */
export async function getActiveSubscription(workspaceId: string): Promise<Subscription | null> {
  return prisma.subscription.findFirst({
    where: {
      workspaceId,
      status: { not: SubscriptionStatus.EXPIRED },
      currentPeriodEnd: { gt: new Date() },
    },
    orderBy: { currentPeriodEnd: 'desc' },
  });
}

/** What a workspace is allowed to do right now. Falls back to FREE without a subscription. */
export async function getEntitlements(workspaceId: string): Promise<Entitlements> {
  const subscription = await getActiveSubscription(workspaceId);
  const plan = subscription?.plan ?? Plan.FREE;
  const definition = PLANS[plan];
  return { plan, limits: definition.limits, features: definition.features, subscription };
}

/** True when the usage is still inside the quota. Unlimited quotas always pass. */
export function isWithinQuota(used: number, quota: Quota): boolean {
  return quota === UNLIMITED || used < quota;
}

// ---------- Invoice payload ----------

const PAYLOAD_PLAN_KEY = 'plan';
const PAYLOAD_WORKSPACE_KEY = 'ws';
const PAYLOAD_PARTS = 4;

export interface InvoicePayload {
  plan: PaidPlan;
  workspaceId: string;
}

/** `plan:<PRO|AGENCY>:ws:<workspaceId>` */
export function buildInvoicePayload(plan: PaidPlan, workspaceId: string): string {
  return [PAYLOAD_PLAN_KEY, plan, PAYLOAD_WORKSPACE_KEY, workspaceId].join(':');
}

export function parseInvoicePayload(raw: string): InvoicePayload | null {
  const parts = raw.split(':');
  if (parts.length !== PAYLOAD_PARTS) return null;

  const [planKey, plan, workspaceKey, workspaceId] = parts;
  if (planKey !== PAYLOAD_PLAN_KEY || workspaceKey !== PAYLOAD_WORKSPACE_KEY) return null;
  if (!workspaceId || !isPaidPlan(plan)) return null;

  return { plan, workspaceId };
}

/**
 * Parse a payload and confirm the payer belongs to the workspace it charges.
 * Returns null for anything we would not want to honour, so callers can simply refuse.
 */
export async function validateInvoicePayload(
  raw: string,
  payerTgId: number,
): Promise<InvoicePayload | null> {
  const parsed = parseInvoicePayload(raw);
  if (!parsed) return null;

  const membership = await prisma.membership.findFirst({
    where: { workspaceId: parsed.workspaceId, user: { tgId: BigInt(payerTgId) } },
    select: { workspaceId: true },
  });
  return membership ? parsed : null;
}

// ---------- Payment write path ----------

export interface SuccessfulPaymentInput {
  /** Telegram charge id: the idempotency key of the whole operation. */
  providerPaymentId: string;
  workspaceId: string;
  plan: Plan;
  /** Whole Stars for XTR, minor units for fiat. */
  amount: number;
  currency: string;
  periodDays: number;
  payerTgId?: number;
  payload?: string;
  provider?: PaymentProvider;
  /** Recurring subscription id, when the provider issues one. */
  providerRef?: string;
}

export interface AppliedPayment {
  subscription: Subscription;
  alreadyProcessed: boolean;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

/**
 * Record a payment and extend the workspace subscription, exactly once per charge id.
 * A replayed webhook (or a retried update) returns alreadyProcessed instead of paying twice.
 */
export async function applySuccessfulPayment(input: SuccessfulPaymentInput): Promise<AppliedPayment> {
  const provider = input.provider ?? PaymentProvider.TELEGRAM_STARS;

  const seen = await prisma.paymentEvent.findUnique({
    where: { providerPaymentId: input.providerPaymentId },
    select: { id: true },
  });
  if (seen) return replayed(input.workspaceId);

  try {
    const subscription = await prisma.$transaction(async (tx) => {
      await tx.paymentEvent.create({
        data: {
          workspaceId: input.workspaceId,
          provider,
          providerPaymentId: input.providerPaymentId,
          plan: input.plan,
          amount: input.amount,
          currency: input.currency,
          periodDays: input.periodDays,
          payerTgId: input.payerTgId === undefined ? null : BigInt(input.payerTgId),
          // Left unset rather than written as JSON null when the invoice carried nothing.
          ...(input.payload === undefined ? {} : { payload: input.payload }),
        },
      });

      const current = await tx.subscription.findFirst({
        where: { workspaceId: input.workspaceId },
        orderBy: { currentPeriodEnd: 'desc' },
      });

      // Paying early must not shorten the period: extend from whichever end is later.
      const now = new Date();
      const base =
        current && current.currentPeriodEnd > now ? current.currentPeriodEnd : now;
      const currentPeriodEnd = addDays(base, input.periodDays);

      const data = {
        plan: input.plan,
        status: SubscriptionStatus.ACTIVE,
        provider,
        providerRef: input.providerRef ?? current?.providerRef ?? null,
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
      };

      const saved = current
        ? await tx.subscription.update({ where: { id: current.id }, data })
        : await tx.subscription.create({ data: { ...data, workspaceId: input.workspaceId } });

      await tx.workspace.update({
        where: { id: input.workspaceId },
        data: { plan: input.plan },
      });

      return saved;
    });

    return { subscription, alreadyProcessed: false };
  } catch (error) {
    // Two updates for the same charge landed at once: the loser rolled back entirely.
    if (isUniqueViolation(error)) return replayed(input.workspaceId);
    throw error;
  }
}

/** The state after a duplicate charge, so callers can render without a second write. */
async function replayed(workspaceId: string): Promise<AppliedPayment> {
  const subscription = await prisma.subscription.findFirst({
    where: { workspaceId },
    orderBy: { currentPeriodEnd: 'desc' },
  });
  if (!subscription) throw new Error(`Payment already processed but no subscription for ${workspaceId}`);
  return { subscription, alreadyProcessed: true };
}
