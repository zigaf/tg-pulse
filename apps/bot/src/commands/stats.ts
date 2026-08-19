import type { Bot } from 'grammy';
import type { BotContext } from '../context';
import { CB, statsMenu } from '../menus';
import { getUserActiveChannels } from '../queries';
import { collectChannelStats, type ChannelStats } from '../stats';
import { allStatsCard } from '../views/stats-view';
import { replyNoChannels } from './empty-states';

/** 7-day stats for every channel of the user, or null when there are none. */
async function collectAll(tgUserId: number): Promise<ChannelStats[] | null> {
  const channels = await getUserActiveChannels(tgUserId);
  if (channels.length === 0) return null;
  return Promise.all(channels.map((channel) => collectChannelStats(channel)));
}

async function sendStats(ctx: BotContext, tgUserId: number): Promise<void> {
  const stats = await collectAll(tgUserId);
  if (!stats) {
    await replyNoChannels(ctx);
    return;
  }
  await ctx.reply(allStatsCard(ctx.dict, stats), {
    parse_mode: 'HTML',
    reply_markup: statsMenu(ctx.dict),
  });
}

export function registerStats(bot: Bot<BotContext>): void {
  bot.command('stats', async (ctx) => {
    if (ctx.chat.type !== 'private' || !ctx.from) return;
    await sendStats(ctx, ctx.from.id);
  });

  // Answered with a new message on purpose: the card the button lives on stays put.
  bot.callbackQuery(CB.goStats, async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendStats(ctx, ctx.from.id);
  });
}
