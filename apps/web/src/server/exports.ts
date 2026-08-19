import { EventType, getPrisma, type Channel } from '@tgpulse/db';
import { periodStart, unsubRate } from './analytics';
import { buildCsv, filenameSlug, type CsvValue } from './csv-writer';
import type { Limit } from './entitlements';
import { ApiError } from './http';
import { trackedLinkUrl } from './links';

/**
 * CSV exports (docs/PHASE7-BUILD.md §3).
 *
 * `days` is optional: without it the export covers everything the channel has, which is what
 * "export my subscribers" means to a user. With it, rows are limited to the window (and for
 * the links export, the counter columns are scoped to it while every link is still listed).
 *
 * Every query is bounded: the plan row cap on FREE, and a hard ceiling on paid plans so a
 * busy channel can never pull its whole event log into memory. When the cap bites, the
 * route reports it through the `X-Export-Truncated` header.
 */

export const EXPORT_TYPES = ['subscribers', 'links', 'events'] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];

/** Ceiling for paid plans; also the ceiling the FREE cap is clamped into. */
export const MAX_EXPORT_ROWS = 50_000;

const FALLBACK_FILENAME_SLUG = 'channel';

export interface ChannelExport {
  filename: string;
  csv: string;
  rowCount: number;
  /** True when more rows matched than the caller's plan allowed. */
  truncated: boolean;
}

interface ExportTable {
  headers: readonly string[];
  rows: CsvValue[][];
  truncated: boolean;
}

function effectiveTake(rowLimit: Limit): number {
  if (rowLimit === null) return MAX_EXPORT_ROWS;
  return Math.max(1, Math.min(rowLimit, MAX_EXPORT_ROWS));
}

/** Fetch one row more than allowed so truncation is detectable without a count query. */
function splitOverflow<T>(rows: T[], take: number): { rows: T[]; truncated: boolean } {
  if (rows.length <= take) return { rows, truncated: false };
  return { rows: rows.slice(0, take), truncated: true };
}

/** `null` since = no time filter at all. */
function sinceFilter(since: Date | null, field: 'joinedAt' | 'ts'): Record<string, unknown> {
  return since ? { [field]: { gte: since } } : {};
}

async function exportSubscribers(
  channelId: string,
  since: Date | null,
  take: number,
): Promise<ExportTable> {
  const found = await getPrisma().subscriber.findMany({
    where: { channelId, ...sinceFilter(since, 'joinedAt') },
    orderBy: [{ joinedAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    select: {
      tgUserId: true,
      username: true,
      firstName: true,
      isPremium: true,
      attribution: true,
      joinedAt: true,
      leftAt: true,
      rejoinCount: true,
      link: { select: { label: true, slug: true, buyer: true } },
    },
  });

  const { rows, truncated } = splitOverflow(found, take);

  return {
    headers: [
      'tg_user_id',
      'username',
      'first_name',
      'is_premium',
      'source_label',
      'source_slug',
      'buyer',
      'attribution',
      'joined_at',
      'left_at',
      'rejoin_count',
    ],
    rows: rows.map((sub) => [
      sub.tgUserId,
      sub.username,
      sub.firstName,
      sub.isPremium,
      sub.link?.label ?? null,
      sub.link?.slug ?? null,
      sub.link?.buyer ?? null,
      sub.attribution,
      sub.joinedAt,
      sub.leftAt,
      sub.rejoinCount,
    ]),
    truncated,
  };
}

interface LinkStatsRow {
  clicks: number;
  joins: number;
  leaves: number;
}

/** Clicks and join/leave counts per link, optionally scoped to a window. */
async function linkStats(
  channelId: string,
  since: Date | null,
): Promise<Map<string, LinkStatsRow>> {
  const prisma = getPrisma();
  const [clickGroups, eventGroups] = await Promise.all([
    prisma.click.groupBy({
      by: ['linkId'],
      where: { link: { channelId }, ...sinceFilter(since, 'ts') },
      _count: { _all: true },
    }),
    prisma.memberEvent.groupBy({
      by: ['linkId', 'type'],
      where: { channelId, linkId: { not: null }, ...sinceFilter(since, 'ts') },
      _count: { _all: true },
    }),
  ]);

  const stats = new Map<string, LinkStatsRow>();
  const rowFor = (linkId: string): LinkStatsRow => {
    const existing = stats.get(linkId) ?? { clicks: 0, joins: 0, leaves: 0 };
    stats.set(linkId, existing);
    return existing;
  };

  for (const group of clickGroups) {
    rowFor(group.linkId).clicks = group._count._all;
  }
  for (const group of eventGroups) {
    if (!group.linkId) continue;
    const row = rowFor(group.linkId);
    if (group.type === EventType.JOIN) row.joins = group._count._all;
    else row.leaves = group._count._all;
  }

  return stats;
}

async function exportLinks(
  channelId: string,
  since: Date | null,
  take: number,
): Promise<ExportTable> {
  // Every link is listed; `days` only scopes the counter columns.
  const [found, statsByLink] = await Promise.all([
    getPrisma().trackedLink.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
    }),
    linkStats(channelId, since),
  ]);

  const { rows, truncated } = splitOverflow(found, take);

  return {
    headers: [
      'slug',
      'url',
      'label',
      'creative',
      'buyer',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'invite_link',
      'is_revoked',
      'clicks',
      'joins',
      'leaves',
      'unsub_rate',
      'created_at',
    ],
    rows: rows.map((link) => {
      const stats = statsByLink.get(link.id);
      return [
        link.slug,
        trackedLinkUrl(link.slug),
        link.label,
        link.creative,
        link.buyer,
        link.utmSource,
        link.utmMedium,
        link.utmCampaign,
        link.inviteLink,
        link.isRevoked,
        stats?.clicks ?? 0,
        stats?.joins ?? 0,
        stats?.leaves ?? 0,
        unsubRate(stats?.joins ?? 0, stats?.leaves ?? 0),
        link.createdAt,
      ];
    }),
    truncated,
  };
}

async function exportEvents(
  channelId: string,
  since: Date | null,
  take: number,
): Promise<ExportTable> {
  const found = await getPrisma().memberEvent.findMany({
    where: { channelId, ...sinceFilter(since, 'ts') },
    orderBy: [{ ts: 'desc' }, { id: 'desc' }],
    take: take + 1,
    select: {
      ts: true,
      type: true,
      tgUserId: true,
      link: { select: { slug: true, label: true, buyer: true } },
    },
  });

  const { rows, truncated } = splitOverflow(found, take);

  return {
    headers: ['ts', 'type', 'tg_user_id', 'link_slug', 'link_label', 'buyer'],
    rows: rows.map((event) => [
      event.ts,
      event.type,
      event.tgUserId,
      event.link?.slug ?? null,
      event.link?.label ?? null,
      event.link?.buyer ?? null,
    ]),
    truncated,
  };
}

function exportFilename(channel: Pick<Channel, 'title' | 'username'>, type: ExportType): string {
  const name = filenameSlug(channel.username ?? channel.title, FALLBACK_FILENAME_SLUG);
  const date = new Date().toISOString().slice(0, 10);
  return `${name}-${type}-${date}.csv`;
}

export async function buildChannelExport(
  channel: Pick<Channel, 'id' | 'title' | 'username'>,
  type: ExportType,
  /** `null` exports the full history. */
  days: number | null,
  rowLimit: Limit,
): Promise<ChannelExport> {
  const take = effectiveTake(rowLimit);
  const since = days === null ? null : periodStart(days);

  let table: ExportTable;
  switch (type) {
    case 'subscribers':
      table = await exportSubscribers(channel.id, since, take);
      break;
    case 'links':
      table = await exportLinks(channel.id, since, take);
      break;
    case 'events':
      table = await exportEvents(channel.id, since, take);
      break;
    default:
      throw new ApiError(400, `Unknown export type: ${String(type)}`);
  }

  return {
    filename: exportFilename(channel, type),
    csv: buildCsv(table.headers, table.rows),
    rowCount: table.rows.length,
    truncated: table.truncated,
  };
}
