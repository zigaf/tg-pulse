'use client';

import type { OverviewTotals } from '@/lib/api';
import { formatNumber, formatRate, formatSigned } from '@/lib/format';
import { Skeleton } from '../shared/States';
import styles from './overview.module.css';

const UNSUB_WARN_THRESHOLD = 8;

export function StatTilesSkeleton() {
  return (
    <div className={styles.tiles} aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className={styles.tile}>
          <Skeleton width={64} height={11} />
          <Skeleton width={90} height={26} />
        </div>
      ))}
    </div>
  );
}

/** Four summary tiles: joins, leaves, net, unsub rate. */
export function StatTiles({ totals }: { totals: OverviewTotals }) {
  const netClass = totals.net > 0 ? styles.valuePositive : totals.net < 0 ? styles.valueNegative : '';
  const unsubClass = totals.unsubRate >= UNSUB_WARN_THRESHOLD ? styles.valueNegative : '';

  return (
    <div className={styles.tiles}>
      <div className={styles.tile}>
        <p className={styles.tileLabel}>Joins</p>
        <p className={`${styles.tileValue} ${styles.valuePositive}`}>{formatNumber(totals.joins)}</p>
      </div>
      <div className={styles.tile}>
        <p className={styles.tileLabel}>Leaves</p>
        <p className={styles.tileValue}>{formatNumber(totals.leaves)}</p>
      </div>
      <div className={styles.tile}>
        <p className={styles.tileLabel}>Net</p>
        <p className={`${styles.tileValue} ${netClass}`}>{formatSigned(totals.net)}</p>
      </div>
      <div className={styles.tile}>
        <p className={styles.tileLabel}>Unsub rate</p>
        <p className={`${styles.tileValue} ${unsubClass}`}>{formatRate(totals.unsubRate)}</p>
      </div>
    </div>
  );
}
