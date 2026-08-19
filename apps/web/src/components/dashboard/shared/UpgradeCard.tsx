'use client';

import { ArrowRight, Lock } from '@phosphor-icons/react';
import Link from 'next/link';
import ui from './ui.module.css';
import styles from './upgrade.module.css';

export const BILLING_HREF = '/app/billing';

/** Billing for a specific workspace; without an id the page falls back to the first one. */
export function billingHref(workspaceId?: string): string {
  return workspaceId ? `${BILLING_HREF}?ws=${encodeURIComponent(workspaceId)}` : BILLING_HREF;
}

/**
 * Shown in place of content the API refused with HTTP 402.
 * One title, one sentence, one way forward.
 */
export function UpgradeCard({
  title,
  description,
  workspaceId,
  eyebrow = 'Paid plan',
}: {
  title: string;
  description: string;
  workspaceId?: string;
  eyebrow?: string;
}) {
  return (
    <section className={styles.panel} aria-labelledby="upgrade-card-title">
      <span className={styles.panelIcon} aria-hidden="true">
        <Lock size={22} weight="duotone" />
      </span>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2 id="upgrade-card-title" className={styles.panelTitle}>
        {title}
      </h2>
      <p className={styles.panelBody}>{description}</p>
      <div className={styles.panelFoot}>
        <Link href={billingHref(workspaceId)} className={ui.btnPrimary}>
          See plans
          <ArrowRight size={14} weight="bold" />
        </Link>
        <span className={styles.footHint}>Upgrades are paid in Telegram Stars, inside the bot.</span>
      </div>
    </section>
  );
}

/** Compact variant for a gate hit on an action, shown above the existing content. */
export function UpgradeNotice({ message, workspaceId }: { message: string; workspaceId?: string }) {
  return (
    <p className={styles.notice} role="status">
      <Lock size={15} weight="duotone" className={styles.noticeIcon} aria-hidden="true" />
      <span className={styles.noticeText}>{message}</span>
      <Link href={billingHref(workspaceId)} className={styles.noticeLink}>
        See plans
        <ArrowRight size={12} weight="bold" />
      </Link>
    </p>
  );
}
