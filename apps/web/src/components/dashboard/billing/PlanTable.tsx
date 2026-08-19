'use client';

import { Check, Minus, TelegramLogo } from '@phosphor-icons/react';
import type { Plan, PlanFeatures, PlanLimits } from '@/lib/api';
import {
  PLAN_CATALOG,
  PLAN_ORDER,
  planFeatureRows,
  planLabel,
  planRank,
  upgradeUrl,
  type PlanFeatureRow,
} from '@/lib/billing';
import { formatNumber } from '@/lib/format';
import ui from '../shared/ui.module.css';
import styles from './billing.module.css';

interface PlanTableProps {
  currentPlan: Plan;
  /** Server truth for the current plan; other cards fall back to the catalog. */
  limits: PlanLimits;
  features: PlanFeatures;
  workspaceId: string;
}

function FeatureItem({ row }: { row: PlanFeatureRow }) {
  return (
    <li className={`${styles.feature} ${row.included ? '' : styles.featureOff}`}>
      {row.included ? (
        <Check size={13} weight="bold" className={styles.featureIcon} aria-hidden="true" />
      ) : (
        <Minus size={13} weight="bold" className={styles.featureIcon} aria-hidden="true" />
      )}
      <span>{row.label}</span>
    </li>
  );
}

function PlanCard({
  plan,
  currentPlan,
  rows,
  workspaceId,
}: {
  plan: Plan;
  currentPlan: Plan;
  rows: PlanFeatureRow[];
  workspaceId: string;
}) {
  const entry = PLAN_CATALOG[plan];
  const isCurrent = plan === currentPlan;
  const isUpgrade = planRank(plan) > planRank(currentPlan);

  return (
    <article className={`${styles.planCard} ${isCurrent ? styles.planCardCurrent : ''}`}>
      <header className={styles.planCardHead}>
        <h3 className={styles.planCardName}>{entry.label}</h3>
        {isCurrent ? <span className={ui.badgePositive}>current</span> : null}
      </header>

      <p className={styles.price}>
        <span className={styles.priceValue}>{entry.priceStars === 0 ? 'Free' : formatNumber(entry.priceStars)}</span>
        {entry.priceStars > 0 ? <span className={styles.priceUnit}>Stars / 30 days</span> : null}
      </p>
      <p className={styles.priceHint}>{entry.priceHint}</p>
      <p className={styles.tagline}>{entry.tagline}</p>

      <ul className={styles.featureList}>
        {rows.map((row) => (
          <FeatureItem key={row.label} row={row} />
        ))}
      </ul>

      {isCurrent ? (
        <p className={styles.planCtaCurrent}>
          <Check size={13} weight="bold" aria-hidden="true" />
          You are on this plan
        </p>
      ) : isUpgrade ? (
        <a
          className={styles.planCta}
          href={upgradeUrl(workspaceId)}
          target="_blank"
          rel="noreferrer"
          aria-label={`Upgrade to ${entry.label} in Telegram`}
        >
          <TelegramLogo size={14} weight="fill" />
          Upgrade in Telegram
        </a>
      ) : (
        <p className={styles.planCardFoot}>Included in {planLabel(currentPlan)}</p>
      )}
    </article>
  );
}

/** Free, Pro and Agency side by side, with the workspace plan marked. */
export function PlanTable({ currentPlan, limits, features, workspaceId }: PlanTableProps) {
  return (
    <div className={styles.planGrid}>
      {PLAN_ORDER.map((plan) => {
        const entry = PLAN_CATALOG[plan];
        const rows =
          plan === currentPlan ? planFeatureRows(limits, features) : planFeatureRows(entry.limits, entry.features);
        return (
          <PlanCard key={plan} plan={plan} currentPlan={currentPlan} rows={rows} workspaceId={workspaceId} />
        );
      })}
    </div>
  );
}
