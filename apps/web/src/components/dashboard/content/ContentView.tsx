'use client';

import { Newspaper } from '@phosphor-icons/react';
import { useEffect, useState, type CSSProperties } from 'react';
import { getChannelContent, type ContentCohortPoint, type ContentReport, type PostKind } from '@/lib/api';
import { formatNumber, formatRate } from '@/lib/format';
import { EmptyState, ErrorState, Skeleton, SkeletonRows } from '../shared/States';
import table from '../shared/table.module.css';
import ui from '../shared/ui.module.css';
import styles from './content.module.css';

type ContentDays = 7 | 30 | 90;
const PERIODS: ContentDays[] = [7, 30, 90];

const TABLE_STYLE = { '--cols': '0.9fr 2.4fr 0.8fr 0.6fr 0.6fr 0.6fr', '--min-width': '900px' } as CSSProperties;
/** Emoji shown next to the total, most-used first. */
const TOP_REACTIONS = 3;

const KIND_LABELS: Record<PostKind, string> = {
  TEXT: 'text',
  PHOTO: 'photo',
  VIDEO: 'video',
  ANIMATION: 'gif',
  DOCUMENT: 'file',
  AUDIO: 'audio',
  VOICE: 'voice',
  STICKER: 'sticker',
  POLL: 'poll',
  OTHER: 'post',
};

function formatMoment(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Daily stacked bars: first-time joins below, rejoins on top. */
function CohortChart({ cohorts }: { cohorts: ContentCohortPoint[] }) {
  const peak = Math.max(1, ...cohorts.map((point) => point.newJoins + point.returningJoins));

  return (
    <div className={`${ui.card} ${styles.cohortCard}`}>
      <div className={styles.cohortChart} role="img" aria-label="New versus returning joins per day">
        {cohorts.map((point) => (
          <div key={point.date} className={styles.cohortCol} title={`${point.date}: ${point.newJoins} new, ${point.returningJoins} returning`}>
            <div
              className={styles.cohortReturning}
              style={{ height: `${(point.returningJoins / peak) * 100}%` }}
            />
            <div className={styles.cohortNew} style={{ height: `${(point.newJoins / peak) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className={styles.cohortLegend}>
        <span>
          <span className={`${styles.legendSwatch} ${styles.legendNew}`} aria-hidden="true" />
          First-time joins
        </span>
        <span>
          <span className={`${styles.legendSwatch} ${styles.legendReturning}`} aria-hidden="true" />
          Returning (rejoined)
        </span>
      </div>
    </div>
  );
}

function ContentSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading content report">
      <div className={styles.tiles}>
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className={styles.tile}>
            <Skeleton width={64} height={11} />
            <Skeleton width={90} height={26} />
          </div>
        ))}
      </div>
      <SkeletonRows rows={5} height={46} />
    </div>
  );
}

/** Post performance (Bot API scope: reactions, no views) and join cohorts. */
export function ContentView({ channelId }: { channelId: string }) {
  const [days, setDays] = useState<ContentDays>(30);
  const [data, setData] = useState<ContentReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    void getChannelContent(channelId, days).then((result) => {
      if (cancelled) return;
      if (result.ok) setData(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [channelId, days, reloadKey]);

  const hasCohortData = data ? data.cohorts.some((point) => point.newJoins + point.returningJoins > 0) : false;

  return (
    <section aria-labelledby="content-heading">
      <header className={styles.pageHead}>
        <div>
          <h1 id="content-heading" className={styles.pageTitle}>
            Content
          </h1>
          <p className={styles.pageHint}>How each post moves reactions, joins and leaves</p>
        </div>
        <div className={styles.segments} role="group" aria-label="Date range">
          {PERIODS.map((option) => (
            <button
              key={option}
              type="button"
              className={`${styles.segment} ${days === option ? styles.segmentActive : ''}`}
              aria-pressed={days === option}
              onClick={() => setDays(option)}
            >
              {option}d
            </button>
          ))}
        </div>
      </header>

      {error ? (
        <div className={ui.card}>
          <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </div>
      ) : data === null ? (
        <ContentSkeleton />
      ) : (
        <>
          <div className={styles.tiles}>
            <div className={styles.tile}>
              <p className={styles.tileLabel}>Posts</p>
              <p className={styles.tileValue}>{formatNumber(data.totals.posts)}</p>
            </div>
            <div className={styles.tile}>
              <p className={styles.tileLabel}>Reactions</p>
              <p className={styles.tileValue}>{formatNumber(data.totals.reactionsTotal)}</p>
              <p className={styles.tileNote}>{data.totals.avgReactions} per post</p>
            </div>
            <div className={styles.tile}>
              <p className={styles.tileLabel}>Avg ERR</p>
              <p className={styles.tileValue}>
                {data.totals.avgErr !== null ? formatRate(data.totals.avgErr) : '—'}
              </p>
              <p className={styles.tileNote}>reactions per 100 subscribers</p>
            </div>
            <div className={styles.tile}>
              <p className={styles.tileLabel}>Returning joins</p>
              <p className={styles.tileValue}>{formatRate(data.totals.returningShare)}</p>
              <p className={styles.tileNote}>
                {formatNumber(data.totals.returningJoins)} of{' '}
                {formatNumber(data.totals.newJoins + data.totals.returningJoins)} joins
              </p>
            </div>
          </div>

          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Join cohorts</h2>
            <p className={styles.sectionHint}>First-time vs returning subscribers per day</p>
          </div>
          {hasCohortData ? (
            <CohortChart cohorts={data.cohorts} />
          ) : (
            <div className={ui.card}>
              <EmptyState title="No joins in this period">
                <p>Cohorts split every join into first-timers and people who rejoined.</p>
              </EmptyState>
            </div>
          )}

          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Posts</h2>
            <p className={styles.sectionHint}>Joins and leaves within 24h of each post</p>
          </div>
          {data.posts.length === 0 ? (
            <div className={ui.card}>
              <EmptyState icon={<Newspaper size={26} weight="duotone" />} title="No posts tracked yet">
                <p>
                  Posts are tracked from the moment the channel was connected. Publish something and it
                  appears here with its reactions and the joins it drove.
                </p>
              </EmptyState>
            </div>
          ) : (
            <div className={table.scroll}>
              <div className={table.table} style={TABLE_STYLE}>
                <div className={table.headRow}>
                  <span>posted</span>
                  <span>post</span>
                  <span className={table.alignRight}>reactions</span>
                  <span className={table.alignRight}>joins 24h</span>
                  <span className={table.alignRight}>leaves 24h</span>
                  <span className={table.alignRight}>err</span>
                </div>
                {data.posts.map((post) => (
                  <div key={post.id} className={`${table.row} ${table.rowHover}`}>
                    <span className={table.cellSub}>{formatMoment(post.postedAt)}</span>
                    <span className={styles.postCell}>
                      <span className={post.preview ? styles.postPreview : `${styles.postPreview} ${styles.postPreviewEmpty}`}>
                        {post.preview || `(${KIND_LABELS[post.kind]} without caption)`}
                      </span>
                      <span className={styles.postMeta}>
                        <span className={styles.kindBadge}>{KIND_LABELS[post.kind]}</span>
                        {post.isEdited ? <span>edited</span> : null}
                      </span>
                    </span>
                    <span className={styles.reactionsCell}>
                      <span className={table.numStrong}>{formatNumber(post.reactionsTotal)}</span>
                      {post.reactions.length > 0 ? (
                        <span className={styles.reactionsTop}>
                          {post.reactions
                            .slice(0, TOP_REACTIONS)
                            .map((row) => `${row.reaction} ${row.count}`)
                            .join('  ')}
                        </span>
                      ) : null}
                    </span>
                    <span className={table.num}>{formatNumber(post.joinsAfter)}</span>
                    <span className={`${table.num} ${post.leavesAfter > post.joinsAfter ? table.bad : ''}`}>
                      {formatNumber(post.leavesAfter)}
                    </span>
                    <span className={table.num}>{post.err !== null ? formatRate(post.err) : '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className={styles.capabilityNote}>
            ERR is reactions per 100 current subscribers. Telegram exposes view counts only to client
            apps, not to bots, so view-based ER is not available here.
          </p>
        </>
      )}
    </section>
  );
}
