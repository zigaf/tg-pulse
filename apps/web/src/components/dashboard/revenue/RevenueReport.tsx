'use client';

import { ChartLineUp, CurrencyCircleDollar, Warning } from '@phosphor-icons/react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { getRevenue, isUpgradeRequired, type ApiRevenueReport, type RevenueDays } from '@/lib/api';
import { EmptyState, ErrorState, Skeleton, SkeletonRows } from '../shared/States';
import ui from '../shared/ui.module.css';
import { PeriodToggle } from './PeriodToggle';
import { RevenueSources } from './RevenueSources';
import { RevenueTiles, RevenueTilesSkeleton } from './RevenueTiles';
import styles from './revenue.module.css';

const CHART_HEIGHT = 250;

/** Recharts is ~100 kB, and the data sources tab never needs it. */
const RevenueChart = dynamic(() => import('./RevenueChart').then((module) => module.RevenueChart), {
  ssr: false,
  loading: () => <Skeleton width="100%" height={CHART_HEIGHT} radius={12} />,
});

function ReportSkeleton() {
  return (
    <div aria-busy="true">
      <RevenueTilesSkeleton />
      <div className={`${ui.card} ${styles.chartCard}`}>
        <Skeleton width="100%" height={CHART_HEIGHT} radius={12} />
      </div>
      <div className={styles.sectionHead}>
        <Skeleton width={120} height={16} />
      </div>
      <SkeletonRows rows={4} />
    </div>
  );
}

interface RevenueReportProps {
  channelId: string;
  days: RevenueDays;
  onDaysChange: (days: RevenueDays) => void;
  /** Bumped by the parent after a CSV import so the report refetches. */
  refreshToken: number;
  /** Sends the user to the data connection panels. */
  onConnect: () => void;
  /** Called when the API answers 402: the parent swaps the whole section for an upgrade card. */
  onLocked: () => void;
}

/** ROMI overview: totals, daily revenue chart, per-source attribution table. */
export function RevenueReport({
  channelId,
  days,
  onDaysChange,
  refreshToken,
  onConnect,
  onLocked,
}: RevenueReportProps) {
  const [report, setReport] = useState<ApiRevenueReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryToken, setRetryToken] = useState(0);

  const retry = useCallback(() => setRetryToken((token) => token + 1), []);

  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setError(null);
    void getRevenue(channelId, days).then((result) => {
      if (isCancelled) return;
      if (result.ok) setReport(result.data);
      else if (isUpgradeRequired(result)) onLocked();
      else setError(result.error);
      setIsLoading(false);
    });
    return () => {
      isCancelled = true;
    };
  }, [channelId, days, refreshToken, retryToken, onLocked]);

  if (error && !report) {
    return (
      <div className={ui.card}>
        <ErrorState message={error} onRetry={retry} />
      </div>
    );
  }

  if (!report) {
    return <ReportSkeleton />;
  }

  const { totals, series, sources, mixedCurrencies } = report;
  const hasSales = totals.purchases > 0 || totals.leads > 0 || totals.refunds > 0;
  const hasRevenue = series.some((point) => point.revenue !== 0);

  return (
    <div className={isLoading ? styles.refreshing : undefined}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Last {days} days</h2>
        <PeriodToggle value={days} onChange={onDaysChange} />
      </div>

      {hasSales ? (
        <>
          <RevenueTiles totals={totals} />

          {mixedCurrencies ? (
            <p className={styles.noticeRow}>
              <span className={ui.badgeWarning}>
                <Warning size={10} weight="fill" />
                Multiple currencies, showing {totals.currency}
              </span>
              <span className={styles.noticeText}>
                Sale events in other currencies are excluded from these totals.
              </span>
            </p>
          ) : null}

          <div className={`${ui.card} ${styles.chartCard}`}>
            {hasRevenue ? (
              <RevenueChart series={series} currency={totals.currency} />
            ) : (
              <EmptyState icon={<ChartLineUp size={26} weight="duotone" />} title="No revenue in this period">
                <p>Leads were recorded, but no purchase settled yet. Widen the period or check back later.</p>
              </EmptyState>
            )}
          </div>

          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Sources</h2>
            <p className={styles.sectionHint}>Revenue attributed to the link that brought the buyer</p>
          </div>
          <RevenueSources sources={sources} currency={totals.currency} />
        </>
      ) : (
        <div className={ui.card}>
          <EmptyState icon={<CurrencyCircleDollar size={26} weight="duotone" />} title="No sales tracked yet">
            <p>
              Send your purchases to TGPulse and every one of them gets tied back to the link that brought the
              buyer. You see which ad earned money, not just which ad brought joins.
            </p>
            <button type="button" className={ui.btn} onClick={onConnect}>
              Connect your sales data
            </button>
          </EmptyState>
        </div>
      )}
    </div>
  );
}
