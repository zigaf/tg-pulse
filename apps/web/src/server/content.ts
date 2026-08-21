import { EventType, getPrisma, type PostKind } from '@tgpulse/db';
import { periodStart, utcDayKey } from './analytics';

/**
 * Content report: per-post performance and join cohorts (docs/CONTENT.md).
 *
 * Post data comes from the Bot API, which never exposes view counts, so the
 * engagement rate here is reactions per current subscribers (ERR), not per
 * view — the UI says so explicitly. Joins and leaves are attributed to the
 * most recent post published within the attribution window before the event.
 */

export const CONTENT_PERIODS = [7, 30, 90] as const;

const DAY_MS = 86_400_000;
/** An event counts toward the latest post published at most this long before it. */
const POST_ATTRIBUTION_MS = 24 * 60 * 60 * 1000;
/**
 * A join whose subscriber record predates the event by more than this is a
 * rejoin. The slack covers the same-transaction timestamps of a first join.
 */
const REJOIN_EPSILON_MS = 60 * 1000;
const PERCENT_SCALE = 2;

export interface ReactionRow {
  reaction: string;
  count: number;
}

export interface ContentPostRow {
  id: string;
  messageId: number;
  postedAt: Date;
  isEdited: boolean;
  kind: PostKind;
  preview: string;
  reactions: ReactionRow[];
  reactionsTotal: number;
  /** Joins/leaves within the attribution window after this post. */
  joinsAfter: number;
  leavesAfter: number;
  /** Reactions per 100 current subscribers; null while the member count is unknown. */
  err: number | null;
}

export interface CohortPoint {
  date: string;
  /** First-ever joins of the channel on that day. */
  newJoins: number;
  /** Joins by people who had been subscribed before (rejoins). */
  returningJoins: number;
}

export interface ContentReport {
  posts: ContentPostRow[];
  totals: {
    posts: number;
    reactionsTotal: number;
    /** Average reactions per post, one decimal. */
    avgReactions: number;
    /** Average ERR across posts; null while the member count is unknown. */
    avgErr: number | null;
    newJoins: number;
    returningJoins: number;
    /** Percent of window joins that are rejoins. */
    returningShare: number;
  };
  cohorts: CohortPoint[];
  memberCount: number | null;
}

function toReactionRows(value: unknown): ReactionRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (row): row is ReactionRow =>
      typeof row === 'object' &&
      row !== null &&
      typeof (row as ReactionRow).reaction === 'string' &&
      typeof (row as ReactionRow).count === 'number',
  );
}

function percentOf(part: number, whole: number): number {
  if (whole === 0) return 0;
  return Number(((part / whole) * 100).toFixed(PERCENT_SCALE));
}

/** Index of the latest post at or before `ts` (posts sorted ascending), or -1. */
function latestPostIndex(postTimes: number[], ts: number): number {
  let low = 0;
  let high = postTimes.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (postTimes[mid] <= ts) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

export async function buildContentReport(channelId: string, days: number): Promise<ContentReport> {
  const since = periodStart(days);
  const prisma = getPrisma();

  const [channel, posts, events] = await Promise.all([
    prisma.channel.findUnique({ where: { id: channelId }, select: { memberCount: true } }),
    prisma.channelPost.findMany({
      where: { channelId, postedAt: { gte: since } },
      orderBy: { postedAt: 'asc' },
      select: {
        id: true,
        messageId: true,
        postedAt: true,
        editedAt: true,
        kind: true,
        preview: true,
        reactions: true,
        reactionsTotal: true,
      },
    }),
    prisma.memberEvent.findMany({
      where: { channelId, ts: { gte: since } },
      select: { type: true, ts: true, tgUserId: true },
    }),
  ]);

  const memberCount = channel?.memberCount ?? null;

  // ---------- rejoin lookup: original joinedAt per subscriber seen in the window ----------

  const joinUserIds = [
    ...new Set(events.filter((e) => e.type === EventType.JOIN).map((e) => e.tgUserId)),
  ];
  const subscribers =
    joinUserIds.length > 0
      ? await prisma.subscriber.findMany({
          where: { channelId, tgUserId: { in: joinUserIds } },
          select: { tgUserId: true, joinedAt: true },
        })
      : [];
  const firstJoinAt = new Map(subscribers.map((s) => [s.tgUserId.toString(), s.joinedAt.getTime()]));

  // ---------- one pass over events: per-post attribution + daily cohorts ----------

  const postTimes = posts.map((post) => post.postedAt.getTime());
  const joinsAfter = new Array<number>(posts.length).fill(0);
  const leavesAfter = new Array<number>(posts.length).fill(0);

  const byDay = new Map<string, { newJoins: number; returningJoins: number }>();
  for (let i = 0; i < days; i++) {
    byDay.set(utcDayKey(new Date(since.getTime() + i * DAY_MS)), { newJoins: 0, returningJoins: 0 });
  }
  let newJoins = 0;
  let returningJoins = 0;

  for (const event of events) {
    const ts = event.ts.getTime();

    const index = latestPostIndex(postTimes, ts);
    if (index >= 0 && ts - postTimes[index] <= POST_ATTRIBUTION_MS) {
      if (event.type === EventType.JOIN) joinsAfter[index] += 1;
      else leavesAfter[index] += 1;
    }

    if (event.type !== EventType.JOIN) continue;
    const first = firstJoinAt.get(event.tgUserId.toString());
    // A missing subscriber row reads as a first join; it cannot prove a rejoin.
    const isReturning = first !== undefined && ts - first > REJOIN_EPSILON_MS;
    if (isReturning) returningJoins += 1;
    else newJoins += 1;
    const day = byDay.get(utcDayKey(event.ts));
    if (day) {
      if (isReturning) day.returningJoins += 1;
      else day.newJoins += 1;
    }
  }

  // ---------- rows, newest first for the table ----------

  const rows: ContentPostRow[] = posts.map((post, index) => ({
    id: post.id,
    messageId: post.messageId,
    postedAt: post.postedAt,
    isEdited: post.editedAt !== null,
    kind: post.kind,
    preview: post.preview,
    reactions: toReactionRows(post.reactions),
    reactionsTotal: post.reactionsTotal,
    joinsAfter: joinsAfter[index],
    leavesAfter: leavesAfter[index],
    err: memberCount ? percentOf(post.reactionsTotal, memberCount) : null,
  }));
  rows.reverse();

  const reactionsTotal = rows.reduce((sum, row) => sum + row.reactionsTotal, 0);
  const errValues = rows.map((row) => row.err).filter((value): value is number => value !== null);

  return {
    posts: rows,
    totals: {
      posts: rows.length,
      reactionsTotal,
      avgReactions: rows.length > 0 ? Number((reactionsTotal / rows.length).toFixed(1)) : 0,
      avgErr:
        errValues.length > 0
          ? Number((errValues.reduce((sum, value) => sum + value, 0) / errValues.length).toFixed(PERCENT_SCALE))
          : null,
      newJoins,
      returningJoins,
      returningShare: percentOf(returningJoins, newJoins + returningJoins),
    },
    cohorts: Array.from(byDay, ([date, stats]) => ({ date, ...stats })),
    memberCount,
  };
}
