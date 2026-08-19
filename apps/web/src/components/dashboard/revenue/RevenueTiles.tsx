'use client';

import type { RevenueTotals } from '@/lib/api';
import { formatMoney, formatNumber, formatRate } from '@/lib/format';
import { Skeleton } from '../shared/States';
import styles from './revenue.module.css';

const TILE_COUNT = 5;
/** Below this share of matched sales the attribution table stops being trustworthy. */
const MATCH_WARN_THRESHOLD = 50;

export function RevenueTilesSkeleton() {
  return (
    <div className={styles.tiles} aria-busy="true">
      {Array.from({ length: TILE_COUNT }, (_, index) => (
        <div key={index} className={styles.tile}>
          <Skeleton width={64} height={11} />
          <Skeleton width={92} height={24} />
        </div>
      ))}
    </div>
  );
}

/** Revenue, purchases, leads, ARPU and matched rate for the selected period. */
export function RevenueTiles({ totals }: { totals: RevenueTotals }) {
  const matchClass = totals.matchedRate < MATCH_WARN_THRESHOLD ? styles.valueMuted : '';

  return (
    <div className={styles.tiles}>
      <div className={`${styles.tile} ${styles.tileLead}`}>
        <p className={styles.tileLabel}>Revenue</p>
        <p className={styles.tileValueLead}>{formatMoney(totals.revenue, totals.currency)}</p>
        {totals.refunds > 0 ? (
          <p className={styles.tileHint}>
            {formatNumber(totals.refunds)} {totals.refunds === 1 ? 'refund' : 'refunds'} subtracted
          </p>
        ) : null}
      </div>

      <div className={styles.tile}>
        <p className={styles.tileLabel}>Purchases</p>
        <p className={styles.tileValue}>{formatNumber(totals.purchases)}</p>
      </div>

      <div className={styles.tile}>
        <p className={styles.tileLabel}>Leads</p>
        <p className={styles.tileValue}>{formatNumber(totals.leads)}</p>
      </div>

      <div className={styles.tile}>
        <p className={styles.tileLabel}>ARPU</p>
        <p className={styles.tileValue}>{formatMoney(totals.arpu, totals.currency)}</p>
        <p className={styles.tileHint}>Per paying buyer</p>
      </div>

      <div className={styles.tile}>
        <p className={styles.tileLabel}>Matched rate</p>
        <p className={`${styles.tileValue} ${matchClass}`}>{formatRate(totals.matchedRate)}</p>
        <p className={styles.tileHint}>Sales tied to a subscriber</p>
      </div>
    </div>
  );
}
