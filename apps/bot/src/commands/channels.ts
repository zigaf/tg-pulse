import type { Bot } from 'grammy';
import { getPrisma, EventType, type Channel } from '@tgpulse/db';
import type { BotContext } from '../context';
import type { Dict } from '../i18n';
import { goUrl } from '../links';
import { backToChannelMenu, channelMenu, channelsListMenu, CHANNELS_PAGE_SIZE } from '../menus';
import { getUserActiveChannels, getUserChannel } from '../queries';
import { collectChannelStats } from '../stats';
import { safeEdit } from '../ui';
import { channelCard, channelsListCard, linksCard, type LinkRow } from '../views/channels-view';
import { channelStatsCard } from '../views/stats-view';
import { editNoChannels, replyNoChannels } from './empty-states';

const prisma = getPrisma();

const LINKS_LIST_LIMIT = 10;

function buildListView(dict: Dict, channels: Channel[], page: number) {
  const totalPages = Math.max(1, Math.ceil(channels.length / CHANNELS_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const pageChannels = channels.slice(safePage * CHANNELS_PAGE_SIZE, (safePage + 1) * CHANNELS_PAGE_SIZE);
  return {
    text: channelsListCard(dict, safePage, totalPages),
    keyboard: channelsListMenu(dict, pageChannels, safePage, totalPages),
  };
}

async function loadLinkRows(channel: Channel): Promise<LinkRow[]> {
  const links = await prisma.trackedLink.findMany({
    where: { channelId: channel.id },
    orderBy: { createdAt: 'desc' },
    take: LINKS_LIST_LIMIT,
    include: { _count: { select: { clicks: true } } },
  });
  if (links.length === 0) return [];

  const joinCounts = await prisma.memberEvent.groupBy({
    by: ['linkId'],
    where: { channelId: channel.id, type: EventType.JOIN, linkId: { in: links.map((l) => l.id) } },
    _count: { _all: true },
  });
  const joinsByLink = new Map(joinCounts.map((row) => [row.linkId, row._count._all]));

  return links.map((link) => ({
    label: link.label,
    clicks: link._count.clicks,
    joins: joinsByLink.get(link.id) ?? 0,
    goUrl: goUrl(link.slug),
    isRevoked: link.isRevoked,
    isLandingPost: link.targetPostUrl !== null,
    buyer: link.buyer,
  }));
}

export function registerChannels(bot: Bot<BotContext>): void {
  bot.command('channels', async (ctx) => {
    if (ctx.chat.type !== 'private' || !ctx.from) return;

    const channels = await getUserActiveChannels(ctx.from.id);
    if (channels.length === 0) {
      await replyNoChannels(ctx);
      return;
    }

    const view = buildListView(ctx.dict, channels, 0);
    await ctx.reply(view.text, { parse_mode: 'HTML', reply_markup: view.keyboard });
  });

  bot.callbackQuery(/^ch:list:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const channels = await getUserActiveChannels(ctx.from.id);
    if (channels.length === 0) {
      await editNoChannels(ctx);
      return;
    }
    const view = buildListView(ctx.dict, channels, Number(ctx.match[1]));
    await safeEdit(ctx, view.text, view.keyboard);
  });

  bot.callbackQuery(/^ch:open:(.+)$/, async (ctx) => {
    const channel = await getUserChannel(ctx.from.id, ctx.match[1]);
    if (!channel) {
      await ctx.answerCallbackQuery({ text: ctx.dict.common.channelUnavailable });
      return;
    }
    await ctx.answerCallbackQuery();
    await safeEdit(ctx, channelCard(ctx.dict, channel), channelMenu(ctx.dict, channel.id));
  });

  bot.callbackQuery(/^ch:stats:(.+)$/, async (ctx) => {
    const channel = await getUserChannel(ctx.from.id, ctx.match[1]);
    if (!channel) {
      await ctx.answerCallbackQuery({ text: ctx.dict.common.channelUnavailable });
      return;
    }
    await ctx.answerCallbackQuery();
    const stats = await collectChannelStats(channel);
    await safeEdit(ctx, channelStatsCard(ctx.dict, stats), backToChannelMenu(ctx.dict, channel.id));
  });

  bot.callbackQuery(/^ch:links:(.+)$/, async (ctx) => {
    const channel = await getUserChannel(ctx.from.id, ctx.match[1]);
    if (!channel) {
      await ctx.answerCallbackQuery({ text: ctx.dict.common.channelUnavailable });
      return;
    }
    await ctx.answerCallbackQuery();
    const rows = await loadLinkRows(channel);
    await safeEdit(ctx, linksCard(ctx.dict, channel, rows), backToChannelMenu(ctx.dict, channel.id));
  });
}
