import type { Bot } from 'grammy';
import { getPrisma, EventType, type Channel } from '@tgpulse/db';
import { escapeHtml, signed } from '../format';
import { getUserActiveChannels, resolveLinkLabels } from '../queries';

const prisma = getPrisma();

const STATS_WINDOW_DAYS = 7;
const TOP_SOURCES_LIMIT = 3;

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

export function registerStats(bot: Bot): void {
  bot.command('stats', async (ctx) => {
    if (ctx.chat.type !== 'private' || !ctx.from) return;

    const channels = await getUserActiveChannels(ctx.from.id);
    if (channels.length === 0) {
      await ctx.reply('No channels connected yet. Add me as an admin to your channel first.');
      return;
    }

    const since = new Date(Date.now() - STATS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const stats = await Promise.all(channels.map((channel) => collectChannelStats(channel, since)));

    await ctx.reply(
      [`Last ${STATS_WINDOW_DAYS} days`, '', ...stats.map(formatChannelStats)].join('\n'),
      { parse_mode: 'HTML' },
    );
  });
}

async function collectChannelStats(channel: Channel, since: Date): Promise<ChannelStats> {
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
  const labels = await resolveLinkLabels(sorted.map((r) => r.linkId).filter((id): id is string => id !== null));
  const topSources = sorted.map((row) => ({
    label: row.linkId ? (labels.get(row.linkId) ?? 'deleted link') : 'organic',
    joins: row._count._all,
  }));

  return { title: channel.title, joins, leaves, topSources };
}

function formatChannelStats(stats: ChannelStats): string {
  const net = stats.joins - stats.leaves;
  const lines = [
    `<b>${escapeHtml(stats.title)}</b>`,
    `<code>+${stats.joins}</code> joins  <code>-${stats.leaves}</code> leaves  <code>${signed(net)}</code> net`,
  ];

  if (stats.topSources.length > 0) {
    lines.push('Top sources:');
    for (const source of stats.topSources) {
      lines.push(`  <code>${source.joins}</code> ${escapeHtml(source.label)}`);
    }
  } else {
    lines.push('No joins in this period.');
  }

  lines.push('');
  return lines.join('\n');
}
