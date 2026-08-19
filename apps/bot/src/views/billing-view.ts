import type { PaymentEvent, Plan } from '@tgpulse/db';
import {
  PAID_PLANS,
  PLANS,
  nextPaidPlan,
  type Entitlements,
  type PaidPlan,
  type Quota,
} from '../billing';
import { escapeHtml, isoDate } from '../format';
import type { Dict } from '../i18n';
import type { PlanOption } from '../menus';
import type { QuotaUsage } from '../quota';
import { card, kv } from '../ui';

const ICON_PLANS = '⭐';
const ICON_BILLING = '💳';
const ICON_PAID = '✅';
const ICON_LOCKED = '🔒';

function quotaText(dict: Dict, quota: Quota): string {
  return quota === null ? dict.billing.unlimited : String(quota);
}

function usageRows(dict: Dict, entitlements: Entitlements, usage: QuotaUsage): string[] {
  const { limits } = entitlements;
  return [
    kv(dict.billing.currentPlan, dict.billing.planName[entitlements.plan]),
    kv(dict.billing.usageChannels, `${usage.channels}/${quotaText(dict, limits.channels)}`),
    kv(dict.billing.usageLinks, `${usage.maxLinksInChannel}/${quotaText(dict, limits.linksPerChannel)}`),
    kv(dict.billing.usageMembers, `${usage.members}/${quotaText(dict, limits.members)}`),
  ];
}

/** One offer block: headline with the price, then what the plan unlocks. */
function offerLines(dict: Dict, plan: PaidPlan): string[] {
  const definition = PLANS[plan];
  return [
    dict.billing.planOffer(dict.billing.planName[plan], definition.priceXtr),
    dict.billing.planPerks(
      definition.limits.channels,
      quotaText(dict, definition.limits.linksPerChannel),
      definition.limits.members,
    ),
  ];
}

/** Buy buttons, priced from PLANS so a price change never needs a dictionary edit. */
export function planOptions(dict: Dict): PlanOption[] {
  return PAID_PLANS.map((plan) => ({
    plan,
    label: dict.billing.buyButton(dict.billing.planName[plan], PLANS[plan].priceXtr),
  }));
}

/** /upgrade: where the workspace stands today, then the two plans it can move to. */
export function plansCard(dict: Dict, entitlements: Entitlements, usage: QuotaUsage): string {
  const body: string[] = [dict.billing.plansIntro];
  for (const plan of PAID_PLANS) {
    body.push('', ...offerLines(dict, plan));
  }

  return card({
    icon: ICON_PLANS,
    title: dict.billing.plansTitle,
    crumbs: [dict.nav.billing, dict.nav.plans],
    rows: usageRows(dict, entitlements, usage),
    body,
    footer: dict.billing.plansFooter(PLANS[nextPaidPlan(entitlements.plan)].periodDays),
  });
}

/** /billing: plan, renewal, quota usage and the payment history, read only. */
export function billingCard(
  dict: Dict,
  entitlements: Entitlements,
  usage: QuotaUsage,
  payments: PaymentEvent[],
): string {
  const { subscription } = entitlements;
  const body: string[] = [];

  if (subscription) {
    const end = isoDate(subscription.currentPeriodEnd);
    body.push(
      subscription.cancelAtPeriodEnd ? dict.billing.activeUntil(end) : dict.billing.renewsOn(end),
    );
    if (subscription.cancelAtPeriodEnd) body.push(dict.billing.cancelScheduled);
  } else {
    body.push(dict.billing.freeBody);
  }

  body.push('', `<b>${dict.billing.paymentsTitle}</b>`);
  if (payments.length === 0) {
    body.push(dict.billing.noPayments);
  } else {
    for (const payment of payments) {
      body.push(
        dict.billing.paymentRow(
          isoDate(payment.createdAt),
          dict.billing.planName[payment.plan],
          payment.amount,
        ),
      );
    }
  }

  return card({
    icon: ICON_BILLING,
    title: dict.billing.title,
    rows: usageRows(dict, entitlements, usage),
    body,
    footer: dict.billing.howToCancel,
  });
}

/** Message that carries the invoice link button. */
export function invoiceCard(dict: Dict, plan: PaidPlan): string {
  return card({
    icon: ICON_PLANS,
    title: dict.billing.planName[plan],
    crumbs: [dict.nav.billing, dict.nav.plans],
    body: [dict.billing.invoicePrompt(dict.billing.planName[plan], PLANS[plan].priceXtr)],
    footer: dict.billing.howToCancel,
  });
}

export function paymentSuccessCard(dict: Dict, plan: Plan, periodEnd: Date): string {
  return card({
    icon: ICON_PAID,
    title: dict.billing.paidTitle,
    body: [dict.billing.paidBody(dict.billing.planName[plan], isoDate(periodEnd))],
    footer: dict.billing.paidFooter,
  });
}

export type UpsellReason = { kind: 'channels' | 'links'; limit: number } | { kind: 'fraud' };

function upsellBody(dict: Dict, plan: Plan, reason: UpsellReason): string {
  const current = dict.billing.planName[plan];
  switch (reason.kind) {
    case 'channels':
      return dict.billing.upsell.channels(current, reason.limit);
    case 'links':
      return dict.billing.upsell.links(current, reason.limit);
    case 'fraud':
      return dict.billing.upsell.fraud(current);
  }
}

/** The card a gate shows instead of an error: what stopped, and what lifts it. */
export function upsellCard(dict: Dict, plan: Plan, reason: UpsellReason): string {
  const offer = nextPaidPlan(plan);
  return card({
    icon: ICON_LOCKED,
    title: dict.billing.upsell.title,
    body: [upsellBody(dict, plan, reason)],
    footer: dict.billing.upsell.footer(dict.billing.planName[offer], PLANS[offer].priceXtr),
  });
}

/** Sent in DM when a connected channel lands above the channel quota. */
export function channelOverQuotaCard(dict: Dict, channelTitle: string, plan: Plan): string {
  const offer = nextPaidPlan(plan);
  return card({
    icon: ICON_LOCKED,
    title: dict.billing.upsell.connectedTitle,
    body: [
      dict.billing.upsell.connectedBody(
        escapeHtml(channelTitle),
        dict.billing.planName[plan],
        PLANS[plan].limits.channels,
      ),
    ],
    footer: dict.billing.upsell.footer(dict.billing.planName[offer], PLANS[offer].priceXtr),
  });
}

/** Shown when billing is asked for before a workspace exists. */
export function noWorkspaceCard(dict: Dict): string {
  return card({
    icon: ICON_BILLING,
    title: dict.billing.title,
    body: [dict.billing.noWorkspace],
    footer: dict.empty.channelsFooter,
  });
}
