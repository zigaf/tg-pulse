import cron from 'node-cron';
import { GrammyError, type Bot } from 'grammy';
import { getPrisma, BotStatus, EventType, type Channel } from '@tgpulse/db';
import { bot } from './bot';
import type { BotContext } from './context';
import { DEFAULT_LANG, getDict, langFromCode, type Lang } from './i18n';
import { getUserActiveChannels, resolveLinkLabels } from './queries';
import { dailyReportCard, type ChannelReport, type ReportSource } from './views/report-view';

const prisma = getPrisma();

const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_REPORT_CRON = '0 9 * * *'; // 09:00 UTC every day
const TOP_SOURCES_LIMIT = 3;
const TG_FORBIDDEN = 403; // user blocked the bot / never started it

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
): Promise<ReportSource[]> {
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
    linkId: row.linkId,
    label: row.linkId ? (labels.get(row.linkId) ?? null) : null,
    count: row._count._all,
  }));
}

async function buildChannelReport(channel: Channel, start: Date, end: Date): Promise<ChannelReport> {
  const [joinSources, leaverSources] = await Promise.all([
    groupBySource(channel.id, EventType.JOIN, start, end),
    groupBySource(channel.id, EventType.LEAVE, start, end),
  ]);

  return {
    title: channel.title,
    joins: joinSources.reduce((sum, s) => sum + s.count, 0),
    leaves: leaverSources.reduce((sum, s) => sum + s.count, 0),
    topSources: joinSources.slice(0, TOP_SOURCES_LIMIT),
    leaverSources,
  };
}

function dateLabel(day: Date): string {
  return day.toISOString().slice(0, 10);
}

/**
 * Send the daily report for the UTC day containing `date` (default: yesterday)
 * to every user of each workspace that has ACTIVE channels, in that user's language.
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

    // The numbers are the same for the whole workspace, only the wording differs,
    // so each language is rendered once and reused across its recipients.
    const byLang = new Map<Lang, string>();
    const textFor = (lang: Lang): string => {
      const cached = byLang.get(lang);
      if (cached) return cached;
      const text = dailyReportCard(getDict(lang), dateLabel(start), reports);
      byLang.set(lang, text);
      return text;
    };

    for (const member of workspace.members) {
      const lang = langFromCode(member.user.languageCode) ?? DEFAULT_LANG;
      try {
        await bot.api.sendMessage(Number(member.user.tgId), textFor(lang), { parse_mode: 'HTML' });
      } catch (error) {
        if (error instanceof GrammyError && error.error_code === TG_FORBIDDEN) continue;
        console.error(`Daily report: failed to message user ${member.user.tgId}`, error);
      }
    }
  }
}

export function registerReports(targetBot: Bot<BotContext>): void {
  // Test helper: sends yesterday's report for the caller's channels to the caller only.
  targetBot.command('report_now', async (ctx) => {
    if (ctx.chat.type !== 'private' || !ctx.from) return;

    const channels = await getUserActiveChannels(ctx.from.id);
    if (channels.length === 0) {
      await ctx.reply(ctx.dict.report.noChannels);
      return;
    }

    const { start, end } = utcDayRange(yesterdayUtc());
    const reports = await Promise.all(channels.map((channel) => buildChannelReport(channel, start, end)));
    await ctx.reply(dailyReportCard(ctx.dict, dateLabel(start), reports), { parse_mode: 'HTML' });
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
