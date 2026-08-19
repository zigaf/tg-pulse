'use client';

import { ChartLineUp, ShareNetwork } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { getOverview, type OverviewData } from '@/lib/api';
import { BuyersPanel } from '../buyers/BuyersPanel';
import { ShareLinksPanel } from '../share/ShareLinksPanel';
import { ShareReportModal } from '../share/ShareReportModal';
import { EmptyState, ErrorState, SkeletonRows, Skeleton } from '../shared/States';
import ui from '../shared/ui.module.css';
import { UpgradeNotice } from '../shared/UpgradeCard';
import { useIsViewer, useWorkspace } from '../shell/workspace-context';
import { RangeToggle, type RangeDays } from './RangeToggle';
import { SourceBreakdown } from './SourceBreakdown';
import { StatTiles, StatTilesSkeleton } from './StatTiles';
import { TrendChart } from './TrendChart';
import styles from './overview.module.css';

function OverviewSkeleton() {
  return (
    <div aria-busy="true">
      <StatTilesSkeleton />
      <div className={`${ui.card} ${styles.chartCard}`}>
        <Skeleton width="100%" height={250} radius={12} />
      </div>
      <div className={styles.sectionHead}>
        <Skeleton width={120} height={16} />
      </div>
      <SkeletonRows rows={4} />
    </div>
  );
}

/** Channel overview: totals, joins/leaves chart, per-source attribution, buyers, shared reports. */
export function OverviewView({ channelId }: { channelId: string }) {
  const [days, setDays] = useState<RangeDays>(7);
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareRefreshKey, setShareRefreshKey] = useState(0);
  const [upgradeMessage, setUpgradeMessage] = useState('');

  const workspace = useWorkspace();
  const isViewer = useIsViewer();

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    void getOverview(channelId, days).then((result) => {
      if (cancelled) return;
      if (result.ok) setData(result.data);
      else setError(result.error);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [channelId, days, reloadKey]);

  const hasActivity = data ? data.series.some((point) => point.joins > 0 || point.leaves > 0) : false;

  return (
    <section aria-labelledby="overview-heading">
      <header className={styles.pageHead}>
        <h1 id="overview-heading" className={styles.pageTitle}>
          Overview
        </h1>
        <div className={styles.headActions}>
          {isViewer ? null : (
            <button type="button" className={ui.btnGhost} onClick={() => setIsShareOpen(true)}>
              <ShareNetwork size={15} />
              Share report
            </button>
          )}
          <RangeToggle value={days} onChange={setDays} />
        </div>
      </header>

      {upgradeMessage ? <UpgradeNotice message={upgradeMessage} workspaceId={workspace?.id} /> : null}

      {error && !data ? (
        <div className={ui.card}>
          <ErrorState message={error} onRetry={retry} />
        </div>
      ) : !data && isLoading ? (
        <OverviewSkeleton />
      ) : data ? (
        <>
          <div className={isLoading ? styles.refreshing : undefined}>
            <StatTiles totals={data.totals} />

            <div className={`${ui.card} ${styles.chartCard}`}>
              {hasActivity ? (
                <TrendChart series={data.series} />
              ) : (
                <EmptyState icon={<ChartLineUp size={26} weight="duotone" />} title="No activity yet">
                  <p>Joins and leaves will appear here once the bot starts tracking members.</p>
                </EmptyState>
              )}
            </div>

            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Sources</h2>
              <p className={styles.sectionHint}>Last {days} days, attributed via tracked links</p>
            </div>
            {data.sources.length === 0 ? (
              <div className={ui.card}>
                <EmptyState title="No sources yet">
                  <p>Create a tracked link on the Links page to start attributing joins.</p>
                </EmptyState>
              </div>
            ) : (
              <SourceBreakdown sources={data.sources} />
            )}
          </div>

          <BuyersPanel channelId={channelId} days={days} />
          <ShareLinksPanel channelId={channelId} refreshKey={shareRefreshKey} canRevoke={!isViewer} />
        </>
      ) : null}

      <ShareReportModal
        channelId={channelId}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        onCreated={() => setShareRefreshKey((key) => key + 1)}
        onUpgradeRequired={setUpgradeMessage}
      />
    </section>
  );
}
