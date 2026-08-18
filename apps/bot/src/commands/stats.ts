import type { Bot } from 'grammy';
import { getPrisma, EventType, type Channel } from '@tgpulse/db';
import { escapeHtml, signed } from '../format';
import { CB } from '../menus';
import { getUserActiveChannels, resolveLinkLabels } from '../queries';
import { texts } from '../texts';

const prisma = getPrisma();

export const STATS_WINDOW_DAYS = 7;
const TOP_SOURCES_LIMIT = 3;
const NUMBER_PAD = 5;

interface SourceRow {
  label: string;
  joins: number;
}

interface ChannelStats {
  title: string;
  joins: number;
  leaves: number;
  topSources: SourceRow[];
}

export async function collectChannelStats(channel: Channel, since: Date): Promise<ChannelStats> {
  const [byType, bySource] = await Promise.all([
    prisma.memberEvent.groupBy({
      by: ['type'],
      where: { channelId: channel.id, ts: { gte: since } },
      _count: { _all: true },
    }),
    prisma.memberEvent.groupBy({
      by: ['linkId'],
      where: { channelId: channel.id, type: EventType.JOIN, ts: { gte: since } },
      _count: { _all: true },
    }),
  ]);

  const joins = byType.find((r) => r.type === EventType.JOIN)?._count._all ?? 0;
  const leaves = byType.find((r) => r.type === EventType.LEAVE)?._count._all ?? 0;

  const sorted = [...bySource].sort((a, b) => b._count._all - a._count._all).slice(0, TOP_SOURCES_LIMIT);
  const labels = await resolveLinkLabels(
    sorted.map((r) => r.linkId).filter((id): id is string => id !== null),
  );
  const topSources = sorted.map((row) => ({
    label: row.linkId ? (labels.get(row.linkId) ?? texts.sources.deletedLink) : texts.sources.organic,
    joins: row._count._all,
  }));

  return { title: channel.title, joins, leaves, topSources };
}

export function formatChannelStats(stats: ChannelStats): string {
  const net = stats.joins - stats.leaves;
  const arrow = net > 0 ? ' ▲' : net < 0 ? ' ▼' : '';
  const lines = [`<b>${escapeHtml(stats.title)}</b>`];

  if (stats.joins === 0 && stats.leaves === 0) {
    lines.push(texts.stats.channelEmpty);
    return lines.join('\n');
  }

  lines.push(
    `<code>Joins  ${String(stats.joins).padStart(NUMBER_PAD)}</code>`,
    `<code>Leaves ${String(stats.leaves).padStart(NUMBER_PAD)}</code>`,
    `<code>Net    ${signed(net).padStart(NUMBER_PAD)}</code>${arrow}`,
  );

  if (stats.topSources.length > 0) {
    lines.push('Top sources:');
    stats.topSources.forEach((source, index) => {
      lines.push(`${index + 1}. ${escapeHtml(source.label)} (${source.joins})`);
    });
  }

  return lines.join('\n');
}

/** 7-day stats text for one channel (used by the /channels menu). */
export async function buildChannelStatsText(channel: Channel): Promise<string> {
  const since = new Date(Date.now() - STATS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const stats = await collectChannelStats(channel, since);
  const blocks = [texts.stats.header(STATS_WINDOW_DAYS), '', formatChannelStats(stats)];
  if (stats.joins === 0 && stats.leaves === 0) {
    blocks.push('', texts.stats.createLinkHint);
  }
  return blocks.join('\n');
}

/** 7-day stats text across all of the user's channels, or null when there are none. */
export async function buildAllStatsText(tgUserId: number): Promise<string | null> {
  const channels = await getUserActiveChannels(tgUserId);
  if (channels.length === 0) return null;

  const since = new Date(Date.now() - STATS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const stats = await Promise.all(channels.map((channel) => collectChannelStats(channel, since)));

  const blocks = [texts.stats.header(STATS_WINDOW_DAYS), '', ...stats.map((s) => `${formatChannelStats(s)}\n`)];
  const hasActivity = stats.some((s) => s.joins > 0 || s.leaves > 0);
  if (!hasActivity) {
    blocks.push(texts.stats.createLinkHint);
  }
  return blocks.join('\n').trimEnd();
}

export function registerStats(bot: Bot): void {
  bot.command('stats', async (ctx) => {
    if (ctx.chat.type !== 'private' || !ctx.from) return;
    const text = await buildAllStatsText(ctx.from.id);
    await ctx.reply(text ?? texts.common.noChannels, { parse_mode: 'HTML' });
  });

  bot.callbackQuery(CB.goStats, async (ctx) => {
    await ctx.answerCallbackQuery();
    const text = await buildAllStatsText(ctx.from.id);
    await ctx.reply(text ?? texts.common.noChannels, { parse_mode: 'HTML' });
  });
}
