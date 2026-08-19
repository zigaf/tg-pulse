'use client';

import type { CSSProperties } from 'react';
import type { PublicReportSource } from '@/lib/api';
import { formatNumber, formatRate } from '@/lib/format';
import table from '../dashboard/shared/table.module.css';
import styles from './report.module.css';

const TABLE_STYLE = { '--cols': '1.8fr 0.6fr 0.6fr 0.6fr 0.6fr', '--min-width': '560px' } as CSSProperties;
const UNSUB_WARN_THRESHOLD = 8;
const TICK_COLORS = ['--src-tgads', '--src-yandex', '--src-seeding', '--src-organic'];

/** Source rows of a shared report. Labels only: no link ids, no revenue, no people. */
export function ReportSources({ sources }: { sources: PublicReportSource[] }) {
  return (
    <div className={table.scroll}>
      <div className={table.table} style={TABLE_STYLE}>
        <div className={table.headRow}>
          <span>source</span>
          <span className={table.alignRight}>clicks</span>
          <span className={table.alignRight}>joins</span>
          <span className={table.alignRight}>leaves</span>
          <span className={table.alignRight}>unsub</span>
        </div>

        {sources.map((source, index) => (
          <div key={`${source.label}-${index}`} className={`${table.row} ${table.rowHover}`}>
            <span className={styles.sourceText}>
              <span
                className={table.tick}
                style={{ background: `var(${TICK_COLORS[index % TICK_COLORS.length]})` }}
              />
              <span className={table.cellTitle}>{source.label}</span>
            </span>
            <span className={table.num}>{formatNumber(source.clicks)}</span>
            <span className={table.numStrong}>{formatNumber(source.joins)}</span>
            <span className={table.num}>{formatNumber(source.leaves)}</span>
            <span className={`${table.num} ${source.unsubRate >= UNSUB_WARN_THRESHOLD ? table.bad : table.good}`}>
              {formatRate(source.unsubRate)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
