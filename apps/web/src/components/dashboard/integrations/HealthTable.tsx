'use client';

import type { CSSProperties } from 'react';
import { AD_PROVIDERS } from '@/lib/ad-providers';
import type { IntegrationsHealth } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import table from '../shared/table.module.css';
import styles from './integrations.module.css';

const TABLE_STYLE = { '--cols': '1.4fr 0.6fr 0.6fr 0.6fr 1fr', '--min-width': '640px' } as CSSProperties;

function formatMoment(value: string | null): string {
  if (!value) return 'never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'never';
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Delivery health over the window the server reports: what the outbox owes each platform,
 * when it last synced and what went wrong the last time it tried.
 */
export function HealthTable({ health }: { health: IntegrationsHealth }) {
  if (health.items.length === 0) return null;

  return (
    <section className={styles.healthBlock} aria-labelledby="integration-health-heading">
      <div className={styles.healthHead}>
        <h2 id="integration-health-heading" className={styles.sectionTitle}>
          Delivery health
        </h2>
        <p className={styles.sectionHint}>Last {health.windowDays} days</p>
      </div>

      <div className={table.scroll}>
        <div className={table.table} style={TABLE_STYLE}>
          <div className={table.headRow}>
            <span>platform</span>
            <span className={table.alignRight}>sent</span>
            <span className={table.alignRight}>queued</span>
            <span className={table.alignRight}>failed</span>
            <span>last sync</span>
          </div>

          {health.items.map((row) => {
            const descriptor = AD_PROVIDERS[row.provider];
            return (
              <div key={row.integrationId} className={`${table.row} ${row.isActive ? '' : styles.rowInactive}`}>
                <span className={table.cellMain}>
                  <span className={table.cellTitle}>{descriptor ? descriptor.name : row.provider}</span>
                </span>
                <span className={table.numStrong}>{formatNumber(row.uploads.sent)}</span>
                <span className={table.num}>{formatNumber(row.uploads.pending)}</span>
                <span className={`${table.num} ${row.uploads.failed > 0 ? table.bad : ''}`}>
                  {formatNumber(row.uploads.failed)}
                </span>
                <span className={table.cellSub}>{formatMoment(row.lastSyncAt)}</span>

                {row.lastError ? (
                  <p className={styles.healthError} title={row.lastError}>
                    {row.lastError}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
