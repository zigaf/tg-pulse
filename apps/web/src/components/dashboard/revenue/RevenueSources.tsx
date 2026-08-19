'use client';

import { CaretDown, CaretUp } from '@phosphor-icons/react';
import { useMemo, useState, type CSSProperties } from 'react';
import type { RevenueSource } from '@/lib/api';
import { formatMoney, formatNumber, formatRate } from '@/lib/format';
import table from '../shared/table.module.css';
import styles from './revenue.module.css';

type SortKey = 'joins' | 'revenue' | 'purchases' | 'conversionRate' | 'romiPerJoin';

interface SourceRow extends RevenueSource {
  colorVar: string;
  isTop: boolean;
}

const LINK_TICK_COLORS = ['--src-tgads', '--src-yandex', '--src-seeding'];
const COLUMNS: { key: SortKey; label: string; title: string }[] = [
  { key: 'joins', label: 'joins', title: 'Joins attributed to this source' },
  { key: 'revenue', label: 'revenue', title: 'Purchases minus refunds' },
  { key: 'purchases', label: 'purchases', title: 'Purchase events' },
  { key: 'conversionRate', label: 'conv', title: 'Joins that produced a purchase' },
  { key: 'romiPerJoin', label: 'per join', title: 'Revenue per join' },
];
const TABLE_STYLE = {
  '--cols': '1.5fr 0.6fr 0.85fr 0.7fr 0.6fr 0.85fr',
  '--min-width': '700px',
} as CSSProperties;

/** Colors follow the server order so they stay stable while the user re-sorts. */
function buildRows(sources: RevenueSource[]): SourceRow[] {
  const topRevenue = Math.max(0, ...sources.map((source) => source.revenue));
  let linkIndex = 0;
  let isTopTaken = false;

  return sources.map((source) => {
    const colorVar =
      source.linkId === null ? '--src-organic' : LINK_TICK_COLORS[linkIndex++ % LINK_TICK_COLORS.length];
    const isTop = !isTopTaken && topRevenue > 0 && source.revenue === topRevenue;
    if (isTop) isTopTaken = true;
    return { ...source, colorVar, isTop };
  });
}

/**
 * Per-source ROMI table. Sortable on every numeric column; the best-earning
 * source keeps a thin accent rail regardless of the active sort.
 */
export function RevenueSources({ sources, currency }: { sources: RevenueSource[]; currency: string }) {
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [isDescending, setIsDescending] = useState(true);

  const rows = useMemo(() => {
    const direction = isDescending ? -1 : 1;
    return buildRows(sources).sort((a, b) => direction * (a[sortKey] - b[sortKey]));
  }, [sources, sortKey, isDescending]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setIsDescending((previous) => !previous);
      return;
    }
    setSortKey(key);
    setIsDescending(true);
  };

  return (
    <div className={table.scroll}>
      <div className={table.table} style={TABLE_STYLE}>
        <div className={table.headRow}>
          <span>source</span>
          {COLUMNS.map((column) => {
            const isActive = column.key === sortKey;
            const Caret = isDescending ? CaretDown : CaretUp;
            return (
              <span key={column.key} className={table.alignRight}>
                <button
                  type="button"
                  className={`${table.sortBtn} ${isActive ? table.sortActive : ''}`}
                  onClick={() => handleSort(column.key)}
                  aria-label={`Sort by ${column.title}`}
                  title={column.title}
                >
                  {column.label}
                  {isActive ? <Caret size={10} weight="bold" /> : null}
                </button>
              </span>
            );
          })}
        </div>

        {rows.map((row) => (
          <div
            key={row.linkId ?? 'organic'}
            className={`${table.row} ${table.rowHover} ${row.isTop ? styles.topRow : ''}`}
          >
            <span className={styles.sourceCell}>
              <span className={table.tick} style={{ background: `var(${row.colorVar})` }} />
              <span className={table.cellTitle}>{row.label}</span>
              {row.isTop ? (
                <span className={styles.topTag} title="Top source by revenue">
                  top
                </span>
              ) : null}
            </span>
            <span className={table.num}>{formatNumber(row.joins)}</span>
            <span className={styles.moneyStrong}>{formatMoney(row.revenue, currency)}</span>
            <span className={table.num}>{formatNumber(row.purchases)}</span>
            <span className={table.num}>{formatRate(row.conversionRate)}</span>
            <span className={table.num}>{formatMoney(row.romiPerJoin, currency)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
