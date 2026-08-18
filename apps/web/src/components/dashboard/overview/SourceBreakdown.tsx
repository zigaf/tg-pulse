'use client';

import { CaretDown, CaretUp } from '@phosphor-icons/react';
import { useMemo, useState, type CSSProperties } from 'react';
import type { OverviewSource } from '@/lib/api';
import { formatNumber, formatRate } from '@/lib/format';
import table from '../shared/table.module.css';
import styles from './overview.module.css';

type SortKey = 'clicks' | 'joins' | 'conv' | 'leaves' | 'unsubRate';

interface SourceComputedRow extends OverviewSource {
  /** joins / clicks, percent; null when clicks = 0 (e.g. organic) */
  conv: number | null;
  colorVar: string;
}

const LINK_TICK_COLORS = ['--src-tgads', '--src-yandex', '--src-seeding'];
const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'clicks', label: 'clicks' },
  { key: 'joins', label: 'joins' },
  { key: 'conv', label: 'conv' },
  { key: 'leaves', label: 'leaves' },
  { key: 'unsubRate', label: 'unsub' },
];
const TABLE_STYLE = { '--cols': '1.6fr 0.6fr 0.6fr 0.6fr 0.6fr 0.6fr', '--min-width': '560px' } as CSSProperties;

function computeRows(sources: OverviewSource[]): SourceComputedRow[] {
  let linkIndex = 0;
  return sources.map((source) => {
    const colorVar = source.linkId === null ? '--src-organic' : LINK_TICK_COLORS[linkIndex++ % LINK_TICK_COLORS.length];
    return {
      ...source,
      conv: source.clicks > 0 ? (source.joins / source.clicks) * 100 : null,
      colorVar,
    };
  });
}

function sortValue(row: SourceComputedRow, key: SortKey): number {
  if (key === 'conv') return row.conv ?? -1;
  return row[key];
}

/** Attribution breakdown per tracked link, organic as its own row. Sortable columns. */
export function SourceBreakdown({ sources }: { sources: OverviewSource[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('joins');
  const [descending, setDescending] = useState(true);

  const rows = useMemo(() => {
    const computed = computeRows(sources);
    const direction = descending ? -1 : 1;
    return [...computed].sort((a, b) => direction * (sortValue(a, sortKey) - sortValue(b, sortKey)));
  }, [sources, sortKey, descending]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setDescending((previous) => !previous);
      return;
    }
    setSortKey(key);
    setDescending(true);
  };

  return (
    <div className={table.scroll}>
      <div className={table.table} style={TABLE_STYLE}>
        <div className={table.headRow}>
          <span>source</span>
          {COLUMNS.map((column) => {
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

        {rows.map((row) => {
          const isOrganic = row.linkId === null;
          return (
            <div key={row.linkId ?? 'organic'} className={`${table.row} ${table.rowHover}`}>
              <span className={table.cellMain}>
                <span className={table.tick} style={{ background: `var(${row.colorVar})` }} />
                <span className={styles.sourceText}>
                  <span className={table.cellTitle}>{isOrganic ? 'Organic' : row.label}</span>
                  {row.creative ? <span className={table.cellSub}>{row.creative}</span> : null}
                </span>
              </span>
              <span className={table.num}>{isOrganic ? 'n/a' : formatNumber(row.clicks)}</span>
              <span className={table.numStrong}>{formatNumber(row.joins)}</span>
              <span className={table.num}>{row.conv === null ? 'n/a' : formatRate(row.conv)}</span>
              <span className={table.num}>{formatNumber(row.leaves)}</span>
              <span className={`${table.num} ${row.unsubRate >= 8 ? table.bad : table.good}`}>
                {formatRate(row.unsubRate)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
