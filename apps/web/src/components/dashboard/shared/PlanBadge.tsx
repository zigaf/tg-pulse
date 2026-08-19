'use client';

import { Lightning } from '@phosphor-icons/react';
import Link from 'next/link';
import type { Plan } from '@/lib/api';
import { planLabel } from '@/lib/billing';
import { billingHref } from './UpgradeCard';
import styles from './upgrade.module.css';

/** Current plan of the workspace, always a shortcut into the billing page. */
export function PlanBadge({ plan, workspaceId }: { plan: Plan; workspaceId?: string }) {
  const isPaid = plan !== 'FREE';
  return (
    <Link
      href={billingHref(workspaceId)}
      className={`${styles.planBadge} ${isPaid ? styles.planBadgePaid : ''}`}
      title="Plan, quota and payments"
    >
      {isPaid ? <Lightning size={11} weight="fill" aria-hidden="true" /> : null}
      {planLabel(plan)}
    </Link>
  );
}
