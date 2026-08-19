'use client';

import type { BillingUsage, PlanLimits } from '@/lib/api';
import { formatQuota, isQuotaFull, quotaRatio, toQuota } from '@/lib/billing';
import { formatNumber } from '@/lib/format';
import styles from './billing.module.css';

interface Quota {
  key: string;
  label: string;
  used: number;
  limit: number | null | undefined;
  /** Shown when the quota is exhausted. */
  fullNote: string;
}

/**
 * One usage rail. Exported so other sections (Team) show the exact same quota
 * treatment instead of inventing a second progress style.
 */
export function QuotaMeter({ label, used, limit: rawLimit, fullNote }: Omit<Quota, 'key'>) {
  const limit = toQuota(rawLimit);
  const isFull = isQuotaFull(used, limit);
  const ratio = quotaRatio(used, limit);

  return (
    <li className={styles.quotaRow}>
      <span className={styles.quotaLabel}>{label}</span>
      <span className={`${styles.quotaValue} ${isFull ? styles.quotaValueFull : ''}`}>
        {formatNumber(used)} / {formatQuota(limit)}
      </span>
      {limit === null ? (
        <span className={styles.quotaUnlimited}>No cap on your plan.</span>
      ) : (
        <span
          className={styles.quotaBar}
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={used}
        >
          <span
            className={`${styles.quotaFill} ${isFull ? styles.quotaFillFull : ''}`}
            style={{ transform: `scaleX(${ratio})` }}
          />
        </span>
      )}
      {isFull ? <span className={styles.quotaNote}>{fullNote}</span> : null}
    </li>
  );
}

/** Thin usage rails for the quotas that block creation: channels and team members. */
export function QuotaBars({ usage, limits }: { usage: BillingUsage; limits: PlanLimits }) {
  const quotas: Quota[] = [
    {
      key: 'channels',
      label: 'Channels',
      used: usage.channels,
      limit: limits.channels,
      fullNote: 'Limit reached. Connecting another channel needs a higher plan.',
    },
    {
      key: 'members',
      label: 'Team members',
      used: usage.members,
      limit: limits.members,
      fullNote: 'Limit reached. Inviting another member needs a higher plan.',
    },
  ];

  return (
    <ul className={styles.quotaList}>
      {quotas.map((quota) => (
        <QuotaMeter
          key={quota.key}
          label={quota.label}
          used={quota.used}
          limit={quota.limit}
          fullNote={quota.fullNote}
        />
      ))}
    </ul>
  );
}
