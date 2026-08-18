import cron from 'node-cron';
import { GrammyError, type Bot } from 'grammy';
import { getPrisma, BotStatus, EventType, type Channel } from '@tgpulse/db';
import { bot } from './bot';
import { escapeHtml, signed } from './format';
import { getUserActiveChannels, resolveLinkLabels } from './queries';

const prisma = getPrisma();

const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_REPORT_CRON = '0 9 * * *'; // 09:00 UTC every day
const TOP_SOURCES_LIMIT = 3;
const TG_FORBIDDEN = 403; // user blocked the bot / never started it

interface SourceCount {
  label: string;
  count: number;
}

interface ChannelReport {
  title: string;
  joins: number;
  leaves: number;
  topSources: SourceCount[];
  leaverSources: SourceCount[];
}

/** [start, end) of the UTC day containing the given date. */
function utcDayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

function yesterdayUtc(): Date {
  return new Date(Date.now() - DAY_MS);
}

async function groupBySource(
  channelId: string,
  type: EventType,
  start: Date,
  end: Date,
): Promise<SourceCount[]> {
  const grouped = await prisma.memberEvent.groupBy({
    by: ['linkId'],
    where: { channelId, type, ts: { gte: start, lt: end } },
    _count: { _all: true },
  });

  const sorted = [...grouped].sort((a, b) => b._count._all - a._count._all);
  const labels = await resolveLinkLabels(
    sorted.map((r) => r.linkId).filter((id): id is string => id !== null),
  );
  return sorted.map((row) => ({
    label: row.linkId ? (labels.get(row.linkId) ?? 'deleted link') : 'organic',
    count: row._count._all,
  }));
}

async function buildChannelReport(channel: Channel, start: Date, end: Date): Promise<ChannelReport> {
  const [joinSources, leaverSources] = await Promise.all([
    groupBySource(channel.id, EventType.JOIN, start, end),
    groupBySource(channel.id, EventType.LEAVE, start, end),
  ]);

  const joins = joinSources.reduce((sum, s) => sum + s.count, 0);
  const leaves = leaverSources.reduce((sum, s) => sum + s.count, 0);

  return {
    title: channel.title,
    joins,
    leaves,
    topSources: joinSources.slice(0, TOP_SOURCES_LIMIT),
    leaverSources,
  };
}

function formatSourceList(sources: SourceCount[]): string {
  return sources.map((s) => `${escapeHtml(s.label)} (<code>${s.count}</code>)`).join(', ');
}

function formatReport(day: Date, reports: ChannelReport[]): string {
  const dateLabel = day.toISOString().slice(0, 10);
  const lines = [`Daily report, ${dateLabel} (UTC)`, ''];

  for (const report of reports) {
    const net = report.joins - report.leaves;
    lines.push(
      `<b>${escapeHtml(report.title)}</b>`,
      `<code>+${report.joins}</code> joins  <code>-${report.leaves}</code> leaves  <code>${signed(net)}</code> net`,
    );
    if (report.topSources.length > 0) {
      lines.push(`Top sources: ${formatSourceList(report.topSources)}`);
    }
    if (report.leaves > 0) {
      lines.push(`Left: <code>${report.leaves}</code>, came from: ${formatSourceList(report.leaverSources)}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

/**
 * Send the daily report for the UTC day containing `date` (default: yesterday)
 * to every user of each workspace that has ACTIVE channels.
 * Users who blocked or never started the bot are skipped silently (403).
 */
export async function sendDailyReports(date?: Date): Promise<void> {
  const day = date ?? yesterdayUtc();
  const { start, end } = utcDayRange(day);

  const workspaces = await prisma.workspace.findMany({
    where: { channels: { some: { botStatus: BotStatus.ACTIVE } } },
    include: {
      channels: { where: { botStatus: BotStatus.ACTIVE }, orderBy: { createdAt: 'asc' } },
      members: { include: { user: true } },
    },
  });

  for (const workspace of workspaces) {
    const reports = await Promise.all(
      workspace.channels.map((channel) => buildChannelReport(channel, start, end)),
    );
    const text = formatReport(start, reports);

    for (const member of workspace.members) {
      try {
        await bot.api.sendMessage(Number(member.user.tgId), text, { parse_mode: 'HTML' });
      } catch (error) {
        if (error instanceof GrammyError && error.error_code === TG_FORBIDDEN) continue;
        console.error(`Daily report: failed to message user ${member.user.tgId}`, error);
      }
    }
  }
}

export function registerReports(targetBot: Bot): void {
  // Test helper: sends yesterday's report for the caller's channels to the caller only.
  targetBot.command('report_now', async (ctx) => {
    if (ctx.chat.type !== 'private' || !ctx.from) return;

    const channels = await getUserActiveChannels(ctx.from.id);
    if (channels.length === 0) {
      await ctx.reply('No active channels yet. Add me as an admin to your channel first.');
      return;
    }

    const { start, end } = utcDayRange(yesterdayUtc());
    const reports = await Promise.all(channels.map((channel) => buildChannelReport(channel, start, end)));
    await ctx.reply(formatReport(start, reports), { parse_mode: 'HTML' });
  });
}

export function startReportCron(): void {
  cron.schedule(
    DAILY_REPORT_CRON,
    () => {
      sendDailyReports().catch((error) => console.error('Daily report run failed', error));
    },
    { timezone: 'Etc/UTC' },
  );
}
