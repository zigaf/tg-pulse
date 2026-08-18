import { GrammyError, type Bot, type Context, type InlineKeyboard } from 'grammy';
import { getPrisma, EventType, type Channel } from '@tgpulse/db';
import { config } from '../config';
import { backToChannelMenu, channelMenu, channelsListMenu, CHANNELS_PAGE_SIZE } from '../menus';
import { getUserActiveChannels, getUserChannel } from '../queries';
import { texts } from '../texts';
import { buildChannelStatsText } from './stats';

const prisma = getPrisma();

const LINKS_LIST_LIMIT = 10;
const NOT_MODIFIED = 'message is not modified';

/** Edit that tolerates "message is not modified" (e.g. tapping the current page again). */
async function safeEdit(ctx: Context, text: string, replyMarkup: InlineKeyboard | undefined): Promise<void> {
  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
      link_preview_options: { is_disabled: true },
    });
  } catch (error) {
    if (error instanceof GrammyError && error.description.includes(NOT_MODIFIED)) return;
    throw error;
  }
}

function buildListView(channels: Channel[], page: number) {
  const totalPages = Math.max(1, Math.ceil(channels.length / CHANNELS_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const pageChannels = channels.slice(safePage * CHANNELS_PAGE_SIZE, (safePage + 1) * CHANNELS_PAGE_SIZE);
  return {
    text: [texts.channels.header(safePage, totalPages), '', texts.channels.pickHint].join('\n'),
    keyboard: channelsListMenu(pageChannels, safePage, totalPages),
  };
}

async function buildLinksText(channel: Channel): Promise<string> {
  const links = await prisma.trackedLink.findMany({
    where: { channelId: channel.id },
    orderBy: { createdAt: 'desc' },
    take: LINKS_LIST_LIMIT,
    include: { _count: { select: { clicks: true } } },
  });

  if (links.length === 0) {
    return [texts.channels.linksHeader(channel.title), '', texts.channels.linksEmpty].join('\n');
  }

  const joinCounts = await prisma.memberEvent.groupBy({
    by: ['linkId'],
    where: { channelId: channel.id, type: EventType.JOIN, linkId: { in: links.map((l) => l.id) } },
    _count: { _all: true },
  });
  const joinsByLink = new Map(joinCounts.map((row) => [row.linkId, row._count._all]));

  const rows = links.map((link, index) =>
    texts.channels.linkRow({
      index: index + 1,
      label: link.label,
      clicks: link._count.clicks,
      joins: joinsByLink.get(link.id) ?? 0,
      goUrl: `${config.goBaseUrl}/l/${link.slug}`,
      isRevoked: link.isRevoked,
    }),
  );

  return [texts.channels.linksHeader(channel.title), '', rows.join('\n\n')].join('\n');
}

export function registerChannels(bot: Bot): void {
  bot.command('channels', async (ctx) => {
    if (ctx.chat.type !== 'private' || !ctx.from) return;

    const channels = await getUserActiveChannels(ctx.from.id);
    if (channels.length === 0) {
      await ctx.reply(texts.common.noChannels);
      return;
    }

    const view = buildListView(channels, 0);
    await ctx.reply(view.text, { parse_mode: 'HTML', reply_markup: view.keyboard });
  });

  bot.callbackQuery(/^ch:list:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const channels = await getUserActiveChannels(ctx.from.id);
    if (channels.length === 0) {
      await safeEdit(ctx, texts.common.noChannels, undefined);
      return;
    }
    const view = buildListView(channels, Number(ctx.match[1]));
    await safeEdit(ctx, view.text, view.keyboard);
  });

  bot.callbackQuery(/^ch:open:(.+)$/, async (ctx) => {
    const channel = await getUserChannel(ctx.from.id, ctx.match[1]);
    if (!channel) {
      await ctx.answerCallbackQuery({ text: texts.common.channelUnavailable });
      return;
    }
    await ctx.answerCallbackQuery();
    await safeEdit(ctx, texts.channels.menu(channel.title, channel.username), channelMenu(channel.id));
  });

  bot.callbackQuery(/^ch:stats:(.+)$/, async (ctx) => {
    const channel = await getUserChannel(ctx.from.id, ctx.match[1]);
    if (!channel) {
      await ctx.answerCallbackQuery({ text: texts.common.channelUnavailable });
      return;
    }
    await ctx.answerCallbackQuery();
    await safeEdit(ctx, await buildChannelStatsText(channel), backToChannelMenu(channel.id));
  });

  bot.callbackQuery(/^ch:links:(.+)$/, async (ctx) => {
    const channel = await getUserChannel(ctx.from.id, ctx.match[1]);
    if (!channel) {
      await ctx.answerCallbackQuery({ text: texts.common.channelUnavailable });
      return;
    }
    await ctx.answerCallbackQuery();
    await safeEdit(ctx, await buildLinksText(channel), backToChannelMenu(channel.id));
  });
}
