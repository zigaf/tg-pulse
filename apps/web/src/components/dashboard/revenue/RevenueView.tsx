'use client';

import { ChartBar, PlugsConnected } from '@phosphor-icons/react';
import { useState, type KeyboardEvent } from 'react';
import type { RevenueDays } from '@/lib/api';
import { ConnectPanels } from './ConnectPanels';
import { RevenueReport } from './RevenueReport';
import styles from './revenue.module.css';

type Tab = 'report' | 'connect';

const TABS: { value: Tab; label: string; icon: typeof ChartBar }[] = [
  { value: 'report', label: 'Report', icon: ChartBar },
  { value: 'connect', label: 'Data sources', icon: PlugsConnected },
];

/** Arrow keys move between tabs, as expected from a tablist. */
function nextTab(current: Tab, key: string): Tab | null {
  const index = TABS.findIndex((item) => item.value === current);
  if (key === 'ArrowRight') return TABS[(index + 1) % TABS.length].value;
  if (key === 'ArrowLeft') return TABS[(index - 1 + TABS.length) % TABS.length].value;
  return null;
}

/**
 * Revenue section. Two in-page tabs instead of a third navigation level: the
 * ROMI report people read daily, and the setup panels they touch once.
 */
export function RevenueView({ channelId }: { channelId: string }) {
  const [tab, setTab] = useState<Tab>('report');
  const [days, setDays] = useState<RevenueDays>(7);
  const [refreshToken, setRefreshToken] = useState(0);

  const handleImported = () => setRefreshToken((token) => token + 1);

  const handleTabKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = nextTab(tab, event.key);
    if (!target) return;
    event.preventDefault();
    setTab(target);
    document.getElementById(`revenue-tab-${target}`)?.focus();
  };

  return (
    <section aria-labelledby="revenue-heading">
      <header className={styles.pageHead}>
        <h1 id="revenue-heading" className={styles.pageTitle}>
          Revenue
        </h1>
        <div className={styles.headActions}>
          <div className={styles.segments} role="tablist" aria-label="Revenue views" onKeyDown={handleTabKeys}>
            {TABS.map(({ value, label, icon: Icon }) => {
              const isActive = tab === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  id={`revenue-tab-${value}`}
                  aria-selected={isActive}
                  aria-controls={`revenue-panel-${value}`}
                  tabIndex={isActive ? 0 : -1}
                  className={`${styles.segment} ${isActive ? styles.segmentActive : ''}`}
                  onClick={() => setTab(value)}
                >
                  <Icon size={13} weight={isActive ? 'fill' : 'regular'} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {tab === 'report' ? (
        <div role="tabpanel" id="revenue-panel-report" aria-labelledby="revenue-tab-report">
          <RevenueReport
            channelId={channelId}
            days={days}
            onDaysChange={setDays}
            refreshToken={refreshToken}
            onConnect={() => setTab('connect')}
          />
        </div>
      ) : (
        <div role="tabpanel" id="revenue-panel-connect" aria-labelledby="revenue-tab-connect">
          <ConnectPanels channelId={channelId} onImported={handleImported} />
        </div>
      )}
    </section>
  );
}
