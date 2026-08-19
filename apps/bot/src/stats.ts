import { getPrisma, EventType, type Channel } from '@tgpulse/db';
import { resolveLinkLabels } from './queries';
import type { SourceRef } from './sources';

const prisma = getPrisma();

export const STATS_WINDOW_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;
const TOP_SOURCES_LIMIT = 3;

export interface SourceStats extends SourceRef {
  joins: number;
}

export interface ChannelStats {
  title: string;
  joins: number;
  leaves: number;
  /** Same-length previous window, for the trend badge. */
  previousJoins: number;
  /** Joins per day inside the window, oldest first. Feeds the sparkline. */
  dailyJoins: number[];
  topSources: SourceStats[];
  /** Joins across all sources, so shares add up even when only the top 3 are shown. */
  sourceJoins: number;
}

function emptyBuckets(): number[] {
  return Array.from({ length: STATS_WINDOW_DAYS }, () => 0);
}

/**
 * Joins, leaves, the daily curve and the top sources for one channel.
 *
 * Events for both the current and the previous window come back in a single read
 * and are bucketed in memory: Prisma cannot group by day, and a second aggregate
 * per channel would double the query count on the /stats fan-out.
 */
export async function collectChannelStats(channel: Channel, now = new Date()): Promise<ChannelStats> {
  const windowMs = STATS_WINDOW_DAYS * DAY_MS;
  const since = new Date(now.getTime() - windowMs);
  const previousSince = new Date(now.getTime() - 2 * windowMs);

  const [events, bySource] = await Promise.all([
    prisma.memberEvent.findMany({
      where: { channelId: channel.id, ts: { gte: previousSince } },
      select: { ts: true, type: true },
    }),
    prisma.memberEvent.groupBy({
      by: ['linkId'],
      where: { channelId: channel.id, type: EventType.JOIN, ts: { gte: since } },
      _count: { _all: true },
    }),
  ]);

  const dailyJoins = emptyBuckets();
  let joins = 0;
  let leaves = 0;
  let previousJoins = 0;

  for (const event of events) {
    const offset = event.ts.getTime() - since.getTime();
    if (offset < 0) {
      if (event.type === EventType.JOIN) previousJoins++;
      continue;
    }
    if (event.type === EventType.JOIN) {
      joins++;
      const bucket = Math.min(STATS_WINDOW_DAYS - 1, Math.floor(offset / DAY_MS));
      dailyJoins[bucket]++;
    } else {
      leaves++;
    }
  }

  const sorted = [...bySource].sort((a, b) => b._count._all - a._count._all);
  const top = sorted.slice(0, TOP_SOURCES_LIMIT);
  const labels = await resolveLinkLabels(top.map((r) => r.linkId).filter((id): id is string => id !== null));

  return {
    title: channel.title,
    joins,
    leaves,
    previousJoins,
    dailyJoins,
    topSources: top.map((row) => ({
      linkId: row.linkId,
      label: row.linkId ? (labels.get(row.linkId) ?? null) : null,
      joins: row._count._all,
    })),
    sourceJoins: sorted.reduce((sum, row) => sum + row._count._all, 0),
  };
}
