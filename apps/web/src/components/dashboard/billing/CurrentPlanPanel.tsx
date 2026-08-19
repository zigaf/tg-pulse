'use client';

import { TelegramLogo } from '@phosphor-icons/react';
import type { BillingData, BillingSubscription } from '@/lib/api';
import { PLAN_CATALOG, planLabel, upgradeUrl } from '@/lib/billing';
import { formatFullDate, formatNumber } from '@/lib/format';
import ui from '../shared/ui.module.css';
import { QuotaBars } from './QuotaBars';
import styles from './billing.module.css';

interface PlanStatus {
  label: string;
  badgeClass: string;
  /** One line under the plan name: when it renews, or when access ends. */
  meta: string;
  metaValue?: string;
}

function planStatus(subscription: BillingSubscription | null): PlanStatus {
  if (!subscription) {
    return { label: 'Free plan', badgeClass: ui.badge, meta: 'No subscription. Nothing to renew.' };
  }

  const status = subscription.status.toUpperCase();
  const endsOn = subscription.currentPeriodEnd ? formatFullDate(subscription.currentPeriodEnd) : 'unknown';

  if (status === 'EXPIRED') {
    return { label: 'Expired', badgeClass: ui.badgeNegative, meta: 'Access ended on', metaValue: endsOn };
  }
  if (subscription.cancelAtPeriodEnd || status === 'CANCELED') {
    return {
      label: 'Canceled at period end',
      badgeClass: ui.badgeWarning,
      meta: 'Access ends on',
      metaValue: endsOn,
    };
  }
  return { label: 'Active', badgeClass: ui.badgePositive, meta: 'Renews on', metaValue: endsOn };
}

/** Headline surface of the billing page: which plan, in what state, and how to change it. */
export function CurrentPlanPanel({ billing, workspaceId }: { billing: BillingData; workspaceId: string }) {
  const status = planStatus(billing.subscription);
  const catalog = PLAN_CATALOG[billing.plan];
  const isPaid = billing.plan !== 'FREE';

  return (
    <section className={`${ui.card} ${styles.planPanel}`} aria-labelledby="current-plan-title">
      <div className={styles.planTop}>
        <div className={styles.planIdentity}>
          <p className={styles.planEyebrow}>Current plan</p>
          <div className={styles.planNameRow}>
            <h2 id="current-plan-title" className={styles.planName}>
              {planLabel(billing.plan)}
            </h2>
            <span className={status.badgeClass}>{status.label}</span>
          </div>
          <p className={styles.planMeta}>
            {status.meta}
            {status.metaValue ? <span className={styles.planMetaStrong}> {status.metaValue}</span> : null}
            {isPaid ? (
              <>
                {' · '}
                <span className={styles.planMetaStrong}>{formatNumber(catalog.priceStars)} Stars</span> per 30 days
              </>
            ) : null}
          </p>
        </div>

        <div className={styles.planActions}>
          <a className={ui.btnPrimary} href={upgradeUrl(workspaceId)} target="_blank" rel="noreferrer">
            <TelegramLogo size={16} weight="fill" />
            Upgrade in Telegram
          </a>
          <p className={styles.planActionHint}>
            Plans are paid in Telegram Stars inside the bot, so this page never asks for a card.
          </p>
        </div>
      </div>

      <QuotaBars usage={billing.usage} limits={billing.limits} />
    </section>
  );
}
