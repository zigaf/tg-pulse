'use client';

import { ArrowRight, ChartLineUp, LinkBreak, Pulse } from '@phosphor-icons/react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getPublicReport, type PublicReportData } from '@/lib/api';
import { StatTiles, StatTilesSkeleton } from '../dashboard/overview/StatTiles';
import { TrendChart } from '../dashboard/overview/TrendChart';
import { EmptyState, ErrorState, Skeleton, SkeletonRows } from '../dashboard/shared/States';
import ui from '../dashboard/shared/ui.module.css';
import { ReportSources } from './ReportSources';
import styles from './report.module.css';

type Phase = 'loading' | 'ready' | 'gone' | 'error';

const GONE = 410;
const NOT_FOUND = 404;

function ReportBar() {
  return (
    <header className={styles.bar}>
      <span className={styles.wordmark}>
        <Pulse size={17} weight="bold" />
        TGPulse
      </span>
      <span className={styles.barNote}>Report shared via TGPulse</span>
      <Link href="/" className={styles.barCta}>
        What is TGPulse
        <ArrowRight size={12} weight="bold" />
      </Link>
    </header>
  );
}

function ReportSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading report">
      <div className={styles.head}>
        <div className={styles.headText}>
          <Skeleton width={90} height={11} />
          <Skeleton width={240} height={30} />
        </div>
        <Skeleton width={120} height={26} radius={999} />
      </div>
      <StatTilesSkeleton />
      <div className={`${ui.card} ${styles.chartCard}`}>
        <Skeleton width="100%" height={250} radius={12} />
      </div>
      <SkeletonRows rows={4} />
    </div>
  );
}

/**
 * Read-only report behind a share token. Deliberately never calls /api/me:
 * the page must work for a client who has no TGPulse account at all.
 */
export function PublicReport({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [data, setData] = useState<PublicReportData | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setPhase('loading');
    setError('');
    const result = await getPublicReport(token);

    if (result.ok) {
      setData(result.data);
      setPhase('ready');
      return;
    }
    if (result.status === GONE || result.status === NOT_FOUND) {
      setPhase('gone');
      return;
    }
    setError(result.error);
    setPhase('error');
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasActivity = data ? data.series.some((point) => point.joins > 0 || point.leaves > 0) : false;

  return (
    <div className={styles.page}>
      <ReportBar />

      <main className={styles.main}>
        {phase === 'gone' ? (
          <section className={styles.gone}>
            <span className={styles.goneIcon} aria-hidden="true">
              <LinkBreak size={24} weight="duotone" />
            </span>
            <h1 className={styles.goneTitle}>Link is not available</h1>
            <p className={styles.goneBody}>
              This report was revoked or has expired. Ask whoever shared it for a fresh link.
            </p>
            <Link href="/" className={ui.btnGhost}>
              See what TGPulse does
            </Link>
          </section>
        ) : phase === 'error' ? (
          <div className={ui.card}>
            <ErrorState message={error} onRetry={() => void load()} />
          </div>
        ) : phase === 'loading' || !data ? (
          <ReportSkeleton />
        ) : (
          <>
            <div className={styles.head}>
              <div className={styles.headText}>
                <p className={styles.eyebrow}>Channel report</p>
                <h1 className={styles.title}>{data.channel.title}</h1>
                {data.channel.username ? <p className={styles.handle}>@{data.channel.username}</p> : null}
              </div>
              <span className={styles.window}>Last {data.windowDays} days</span>
            </div>

            <StatTiles totals={data.totals} />

            <div className={`${ui.card} ${styles.chartCard}`}>
              {hasActivity ? (
                <TrendChart series={data.series} />
              ) : (
                <EmptyState icon={<ChartLineUp size={26} weight="duotone" />} title="No activity in this period">
                  <p>Joins and leaves appear here as soon as the channel starts moving.</p>
                </EmptyState>
              )}
            </div>

            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Sources</h2>
              <p className={styles.sectionHint}>Where the joins of the period came from</p>
            </div>
            {data.sources.length === 0 ? (
              <div className={ui.card}>
                <EmptyState title="No attributed sources yet">
                  <p>Traffic has not been split by source in this period.</p>
                </EmptyState>
              </div>
            ) : (
              <ReportSources sources={data.sources} />
            )}

            <footer className={styles.foot}>
              <span>Read-only report. Subscriber identities and revenue stay private.</span>
              <Link href="/" className={styles.footLink}>
                Track your own channel with TGPulse
                <ArrowRight size={12} weight="bold" />
              </Link>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
