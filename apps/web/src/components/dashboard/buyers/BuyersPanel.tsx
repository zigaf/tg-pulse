'use client';

import { CaretDown, CaretUp, UserFocus } from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { getBuyers, type BuyerRow } from '@/lib/api';
import { formatMoney, formatNumber, formatRate } from '@/lib/format';
import { EmptyState, ErrorState, SkeletonRows } from '../shared/States';
import table from '../shared/table.module.css';
import ui from '../shared/ui.module.css';
import styles from './buyers.module.css';

type SortKey = 'links' | 'clicks' | 'joins' | 'unsubRate' | 'revenue';

const UNSUB_WARN_THRESHOLD = 8;

const BASE_COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'links', label: 'links' },
  { key: 'clicks', label: 'clicks' },
  { key: 'joins', label: 'joins' },
  { key: 'unsubRate', label: 'unsub' },
];

const REVENUE_COLUMN: { key: SortKey; label: string } = { key: 'revenue', label: 'revenue' };

function sortValue(row: BuyerRow, key: SortKey): number {
  if (key === 'revenue') return row.revenue ?? -1;
  return row[key] ?? 0;
}

/**
 * Per-buyer comparison for the selected period. Unassigned links stay in their own row
 * at the bottom, so a missing buyer tag never competes with real people in the ranking.
 */
export function BuyersPanel({ channelId, days }: { channelId: string; days: number }) {
  const [rows, setRows] = useState<BuyerRow[] | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMissing, setIsMissing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('joins');
  const [descending, setDescending] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    const result = await getBuyers(channelId, days);
    setIsLoading(false);

    if (result.ok) {
      setRows(result.data.buyers);
      setCurrency(result.data.currency ?? null);
      setError(null);
      setIsMissing(false);
      return;
    }
    // No envelope means the endpoint is not there: hide the section instead of alarming the user.
    setRows([]);
    setIsMissing(!result.envelope);
    setError(result.envelope ? result.error : null);
  }, [channelId, days]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasRevenue = useMemo(
    () => (rows ?? []).some((row) => typeof row.revenue === 'number'),
    [rows],
  );

  const columns = hasRevenue ? [...BASE_COLUMNS, REVENUE_COLUMN] : BASE_COLUMNS;
  const tableStyle = {
    '--cols': hasRevenue
      ? '1.4fr 0.5fr 0.6fr 0.6fr 0.6fr 0.8fr'
      : '1.6fr 0.5fr 0.6fr 0.6fr 0.6fr',
    '--min-width': hasRevenue ? '680px' : '560px',
  } as CSSProperties;

  const sorted = useMemo(() => {
    const list = rows ?? [];
    const named = list.filter((row) => row.buyer !== null && row.buyer !== '');
    const unassigned = list.filter((row) => row.buyer === null || row.buyer === '');
    const direction = descending ? -1 : 1;
    const orderedNamed = [...named].sort((a, b) => direction * (sortValue(a, sortKey) - sortValue(b, sortKey)));
    return [...orderedNamed, ...unassigned];
  }, [rows, sortKey, descending]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setDescending((previous) => !previous);
      return;
    }
    setSortKey(key);
    setDescending(true);
  };

  if (isMissing) return null;
  if (rows === null && isLoading) return null;

  return (
    <section aria-labelledby="buyers-heading">
      <div className={styles.sectionHead}>
        <h2 id="buyers-heading" className={styles.sectionTitle}>
          Buyers
        </h2>
        <p className={styles.sectionHint}>Last {days} days, grouped by the buyer tag on each link</p>
      </div>

      {error ? (
        <div className={ui.card}>
          <ErrorState message={error} onRetry={() => void load()} />
        </div>
      ) : isLoading && sorted.length === 0 ? (
        <SkeletonRows rows={3} height={42} />
      ) : sorted.length === 0 ? (
        <div className={ui.card}>
          <EmptyState icon={<UserFocus size={26} weight="duotone" />} title="No buyer data yet">
            <p>Set a media buyer when you create a tracking link and their placements get compared here.</p>
          </EmptyState>
        </div>
      ) : (
        <div className={table.scroll}>
          <div className={table.table} style={tableStyle}>
            <div className={table.headRow}>
              <span>buyer</span>
              {columns.map((column) => {
                const isActive = column.key === sortKey;
                const Caret = descending ? CaretDown : CaretUp;
                return (
                  <span key={column.key} className={table.alignRight}>
                    <button
                      type="button"
                      className={`${table.sortBtn} ${isActive ? table.sortActive : ''}`}
                      onClick={() => handleSort(column.key)}
                      aria-label={`Sort by ${column.label}`}
                    >
                      {column.label}
                      {isActive ? <Caret size={10} weight="bold" /> : null}
                    </button>
                  </span>
                );
              })}
            </div>

            {sorted.map((row) => {
              const isUnassigned = row.buyer === null || row.buyer === '';
              return (
                <div
                  key={row.buyer ?? 'unassigned'}
                  className={`${table.row} ${table.rowHover} ${isUnassigned ? styles.rowUnassigned : ''}`}
                >
                  <span className={styles.buyerCell}>
                    <span
                      className={table.tick}
                      style={{ background: isUnassigned ? 'var(--src-organic)' : 'var(--src-tgads)' }}
                    />
                    <span className={`${styles.buyerName} ${isUnassigned ? styles.unassigned : ''}`}>
                      {isUnassigned ? 'Unassigned' : row.buyer}
                    </span>
                  </span>
                  <span className={table.num}>{formatNumber(row.links)}</span>
                  <span className={table.num}>{formatNumber(row.clicks)}</span>
                  <span className={table.numStrong}>{formatNumber(row.joins)}</span>
                  <span className={`${table.num} ${row.unsubRate >= UNSUB_WARN_THRESHOLD ? table.bad : table.good}`}>
                    {formatRate(row.unsubRate)}
                  </span>
                  {hasRevenue ? (
                    <span className={table.numStrong}>
                      {typeof row.revenue === 'number'
                        ? formatMoney(row.revenue, row.currency ?? currency ?? 'USD')
                        : 'n/a'}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
