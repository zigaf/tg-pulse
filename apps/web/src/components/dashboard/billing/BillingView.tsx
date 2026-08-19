'use client';

import { ArrowLeft, Pulse } from '@phosphor-icons/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { getBilling, getMe, type ApiWorkspace, type BillingData } from '@/lib/api';
import { normalizeBilling } from '@/lib/billing';
import { ErrorState, Skeleton, SkeletonRows } from '../shared/States';
import ui from '../shared/ui.module.css';
import { CurrentPlanPanel } from './CurrentPlanPanel';
import { PaymentsTable } from './PaymentsTable';
import { PlanTable } from './PlanTable';
import styles from './billing.module.css';

type Phase = 'loading' | 'ready' | 'error';

function BillingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading billing">
      <span className={ui.skeleton} style={{ height: 232, borderRadius: 'var(--radius-lg)' }} />
      <div className={styles.sectionHead}>
        <Skeleton width={90} height={18} />
      </div>
      <div className={styles.planGrid}>
        {Array.from({ length: 3 }, (_, index) => (
          <span key={index} className={ui.skeleton} style={{ height: 330, borderRadius: 'var(--radius-lg)' }} />
        ))}
      </div>
      <div className={styles.sectionHead}>
        <Skeleton width={110} height={18} />
      </div>
      <SkeletonRows rows={3} />
    </div>
  );
}

/**
 * Read-only billing page (docs/BILLING.md): plan, quota usage, plan comparison and
 * payment history. Every state change happens in the bot, so the page only deep-links there.
 */
export function BillingView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceParam = searchParams.get('ws');

  const [phase, setPhase] = useState<Phase>('loading');
  const [workspace, setWorkspace] = useState<ApiWorkspace | null>(null);
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setPhase('loading');
    setError('');

    const meResult = await getMe();
    if (!meResult.ok) {
      if (meResult.status === 401) {
        router.replace('/app');
        return;
      }
      setError(meResult.error);
      setPhase('error');
      return;
    }

    const workspaces = meResult.data.workspaces;
    const selected = workspaces.find((item) => item.id === workspaceParam) ?? workspaces[0];
    if (!selected) {
      setError('This account has no workspace yet. Connect a channel first.');
      setPhase('error');
      return;
    }
    setWorkspace(selected);

    const billingResult = await getBilling(selected.id);
    if (!billingResult.ok) {
      setError(billingResult.error);
      setPhase('error');
      return;
    }
    setBilling(normalizeBilling(billingResult.data));
    setPhase('ready');
  }, [router, workspaceParam]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/app" className={styles.backLink}>
          <ArrowLeft size={14} />
          Channels
        </Link>
        <span className={styles.wordmark}>
          <Pulse size={17} weight="bold" />
          TGPulse
        </span>
      </header>

      <section aria-labelledby="billing-heading">
        <div className={styles.headingRow}>
          <h1 id="billing-heading" className={styles.heading}>
            Billing
          </h1>
          <p className={styles.headingHint}>
            {workspace ? `${workspace.name} · plan, quota and payments` : 'Plan, quota and payments'}
          </p>
        </div>

        {phase === 'error' ? (
          <div className={ui.card}>
            <ErrorState message={error} onRetry={() => void load()} />
          </div>
        ) : phase === 'loading' || !billing || !workspace ? (
          <BillingSkeleton />
        ) : (
          <>
            <CurrentPlanPanel billing={billing} workspaceId={workspace.id} />

            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Plans</h2>
              <p className={styles.sectionHint}>Billed per workspace, not per channel</p>
            </div>
            <PlanTable
              currentPlan={billing.plan}
              limits={billing.limits}
              features={billing.features}
              workspaceId={workspace.id}
            />

            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Payments</h2>
              <p className={styles.sectionHint}>Confirmed Stars charges</p>
            </div>
            <PaymentsTable payments={billing.payments} />
          </>
        )}
      </section>
    </main>
  );
}
