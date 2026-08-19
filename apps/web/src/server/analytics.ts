import { EventType, getPrisma } from '@tgpulse/db';
import { ApiError } from './http';

/**
 * Channel analytics over a rolling window of whole UTC days.
 *
 * Shared by the dashboard overview, the public share report and the buyer
 * comparison so all three always agree on the same numbers.
 */

const DAY_MS = 86_400_000;
const PERCENT_SCALE = 2;

/** Windows the dashboard overview offers. */
export const OVERVIEW_PERIODS = [7, 30] as const;
/** Windows the share report and buyer comparison offer. */
export const REPORT_PERIODS = [7, 30, 90] as const;

/** Parse a `days` query param against an allow-list; the first entry is the default. */
export function parseDaysParam(raw: string | null, allowed: readonly number[]): number {
  const days = Number(raw ?? allowed[0]);
  const match = allowed.find((period) => period === days);
  if (match === undefined) {
    throw new ApiError(400, `days must be one of ${allowed.join(', ')}`);
  }
  return match;
}

export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Start of the window: UTC midnight, `days - 1` days back, so today is included. */
export function periodStart(days: number, now = new Date()): Date {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(midnight - (days - 1) * DAY_MS);
}

/** Percent number (3.2 means 3.2%) — the dashboard formats it with a % suffix. */
export function unsubRate(joins: number, leaves: number): number {
  if (joins === 0) return 0;
  return Number(((leaves / joins) * 100).toFixed(PERCENT_SCALE));
}

interface JoinLeave {
  joins: number;
  leaves: number;
}

export interface ChannelSourceRow extends JoinLeave {
  /** `null` on the synthetic "Organic" row: joins with no tracked link. */
  linkId: string | null;
  label: string;
  creative: string | null;
  buyer: string | null;
  clicks: number;
  unsubRate: number;
}

export interface ChannelReport {
  totals: JoinLeave & { net: number; unsubRate: number };
  series: (JoinLeave & { date: string })[];
  sources: ChannelSourceRow[];
}

const ORGANIC_LABEL = 'Organic';

/** Joins, leaves and clicks for the window, split per UTC day and per source link. */
export async function buildChannelReport(channelId: string, days: number): Promise<ChannelReport> {
  const since = periodStart(days);
  const prisma = getPrisma();

  const [events, clickGroups, links] = await Promise.all([
    prisma.memberEvent.findMany({
      where: { channelId, ts: { gte: since } },
      select: { type: true, ts: true, linkId: true },
    }),
    prisma.click.groupBy({
      by: ['linkId'],
      where: { ts: { gte: since }, link: { channelId } },
      _count: { _all: true },
    }),
    prisma.trackedLink.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, label: true, creative: true, buyer: true },
    }),
  ]);

  // Aggregate the raw event log per UTC day and per source link in one pass.
  const byDay = new Map<string, JoinLeave>();
  for (let i = 0; i < days; i++) {
    byDay.set(utcDayKey(new Date(since.getTime() + i * DAY_MS)), { joins: 0, leaves: 0 });
  }
  const byLink = new Map<string | null, JoinLeave>();
  const totals: JoinLeave = { joins: 0, leaves: 0 };

  for (const event of events) {
    const day = byDay.get(utcDayKey(event.ts));
    let source = byLink.get(event.linkId);
    if (!source) {
      source = { joins: 0, leaves: 0 };
      byLink.set(event.linkId, source);
    }
    const field = event.type === EventType.JOIN ? 'joins' : 'leaves';
    totals[field] += 1;
    source[field] += 1;
    if (day) day[field] += 1;
  }

  const clicksByLink = new Map(clickGroups.map((group) => [group.linkId, group._count._all]));

  const toRow = (
    linkId: string | null,
    label: string,
    creative: string | null,
    buyer: string | null,
  ): ChannelSourceRow => {
    const stats = byLink.get(linkId) ?? { joins: 0, leaves: 0 };
    return {
      linkId,
      label,
      creative,
      buyer,
      clicks: linkId === null ? 0 : (clicksByLink.get(linkId) ?? 0),
      joins: stats.joins,
      leaves: stats.leaves,
      unsubRate: unsubRate(stats.joins, stats.leaves),
    };
  };

  const sources = [
    ...links.map((link) => toRow(link.id, link.label, link.creative, link.buyer)),
    toRow(null, ORGANIC_LABEL, null, null),
  ].sort((a, b) => b.joins - a.joins || b.clicks - a.clicks);

  return {
    totals: {
      joins: totals.joins,
      leaves: totals.leaves,
      net: totals.joins - totals.leaves,
      unsubRate: unsubRate(totals.joins, totals.leaves),
    },
    series: Array.from(byDay, ([date, stats]) => ({ date, ...stats })),
    sources,
  };
}
