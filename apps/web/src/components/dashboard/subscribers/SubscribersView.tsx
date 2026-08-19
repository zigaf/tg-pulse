'use client';

import { MagnifyingGlass, Star, UsersThree } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { getSubscribers, type SubscriberRow } from '@/lib/api';
import { formatFullDate } from '@/lib/format';
import { ExportButton, ExportLimitNote } from '../shared/ExportButton';
import { EmptyState, ErrorState, SkeletonRows } from '../shared/States';
import table from '../shared/table.module.css';
import ui from '../shared/ui.module.css';
import styles from './subscribers.module.css';

const TABLE_STYLE = { '--cols': '1.5fr 1fr 0.8fr 0.6fr', '--min-width': '580px' } as CSSProperties;
const SEARCH_DEBOUNCE_MS = 300;

function SubscriberLine({ subscriber }: { subscriber: SubscriberRow }) {
  const name = subscriber.firstName || subscriber.username || subscriber.tgUserId;
  return (
    <div className={`${table.row} ${table.rowHover}`}>
      <span className={styles.nameCell}>
        <span className={styles.nameLine}>
          <span className={table.cellTitle}>{name}</span>
          {subscriber.isPremium ? (
            <Star size={12} weight="fill" className={styles.premium} aria-label="Telegram Premium" />
          ) : null}
        </span>
        {subscriber.username ? <span className={table.cellSub}>@{subscriber.username}</span> : null}
      </span>
      <span className={styles.sourceCell}>
        {subscriber.source ? (
          <>
            <span className={table.tick} style={{ background: 'var(--src-tgads)' }} />
            <span className={table.cellTitle}>{subscriber.source.label}</span>
          </>
        ) : (
          <>
            <span className={table.tick} style={{ background: 'var(--src-organic)' }} />
            <span className={styles.organic}>organic</span>
          </>
        )}
      </span>
      <span className={table.num}>{formatFullDate(subscriber.joinedAt)}</span>
      <span className={styles.statusCell}>
        {subscriber.leftAt ? <span className={ui.badgeNegative}>left</span> : <span className={ui.badgePositive}>active</span>}
      </span>
    </div>
  );
}

/** Subscribers list: debounced search + cursor pagination. */
export function SubscribersView({ channelId }: { channelId: string }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [items, setItems] = useState<SubscriberRow[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const requestSeq = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const loadFirstPage = useCallback(async () => {
    const seq = ++requestSeq.current;
    setItems(null);
    setError(null);
    setNextCursor(null);
    const result = await getSubscribers(channelId, { q: debouncedQuery || undefined });
    if (seq !== requestSeq.current) return;
    if (result.ok) {
      setItems(result.data.items);
      setNextCursor(result.data.nextCursor);
    } else {
      setError(result.error);
    }
  }, [channelId, debouncedQuery]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  const loadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    const seq = requestSeq.current;
    setIsLoadingMore(true);
    const result = await getSubscribers(channelId, { cursor: nextCursor, q: debouncedQuery || undefined });
    if (seq !== requestSeq.current) return;
    setIsLoadingMore(false);
    if (result.ok) {
      setItems((previous) => [...(previous ?? []), ...result.data.items]);
      setNextCursor(result.data.nextCursor);
    } else {
      setError(result.error);
    }
  };

  return (
    <section aria-labelledby="subscribers-heading">
      <header className={styles.pageHead}>
        <h1 id="subscribers-heading" className={styles.pageTitle}>
          Subscribers
        </h1>
        <div className={styles.headActions}>
          <div className={styles.search}>
            <MagnifyingGlass size={15} className={styles.searchIcon} aria-hidden="true" />
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search by name or username"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search subscribers"
            />
          </div>
          <ExportButton channelId={channelId} type="subscribers" />
        </div>
      </header>

      <ExportLimitNote />

      {error && items === null ? (
        <div className={ui.card}>
          <ErrorState message={error} onRetry={() => void loadFirstPage()} />
        </div>
      ) : items === null ? (
        <SkeletonRows rows={8} height={44} />
      ) : items.length === 0 ? (
        <div className={ui.card}>
          <EmptyState
            icon={<UsersThree size={26} weight="duotone" />}
            title={debouncedQuery ? 'Nobody matches this search' : 'No subscribers tracked yet'}
          >
            <p>
              {debouncedQuery
                ? 'Try a different name or username.'
                : 'New joins and leaves will appear here as the bot observes them.'}
            </p>
          </EmptyState>
        </div>
      ) : (
        <>
          <div className={table.scroll}>
            <div className={table.table} style={TABLE_STYLE}>
              <div className={table.headRow}>
                <span>subscriber</span>
                <span>source</span>
                <span className={table.alignRight}>joined</span>
                <span className={styles.statusHead}>status</span>
              </div>
              {items.map((subscriber) => (
                <SubscriberLine key={subscriber.tgUserId} subscriber={subscriber} />
              ))}
            </div>
          </div>

          {error ? (
            <p className={styles.moreError} role="alert">
              {error}
            </p>
          ) : null}

          {nextCursor ? (
            <div className={styles.moreWrap}>
              <button type="button" className={ui.btnGhost} onClick={() => void loadMore()} disabled={isLoadingMore}>
                {isLoadingMore ? 'Loading' : 'Load more'}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
