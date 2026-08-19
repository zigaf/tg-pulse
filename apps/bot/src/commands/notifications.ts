import type { Bot } from 'grammy';
import type { Channel } from '@tgpulse/db';
import type { BotContext } from '../context';
import type { Dict } from '../i18n';
import { notificationsMenu } from '../menus';
import { getSubscribedChannelIds, toggleSubscription } from '../notifications';
import { getUserActiveChannels, getUserChannel } from '../queries';
import { alertsCard } from '../views/alerts-view';
import { replyNoChannels } from './empty-states';

async function buildMenu(dict: Dict, tgUserId: number, channels: Channel[]) {
  const subscribed = await getSubscribedChannelIds(
    tgUserId,
    channels.map((channel) => channel.id),
  );
  return notificationsMenu(dict, channels, subscribed);
}

export function registerNotifications(bot: Bot<BotContext>): void {
  bot.command('notifications', async (ctx) => {
    if (ctx.chat.type !== 'private' || !ctx.from) return;

    const channels = await getUserActiveChannels(ctx.from.id);
    if (channels.length === 0) {
      await replyNoChannels(ctx);
      return;
    }

    await ctx.reply(alertsCard(ctx.dict), {
      parse_mode: 'HTML',
      reply_markup: await buildMenu(ctx.dict, ctx.from.id, channels),
    });
  });

  bot.callbackQuery(/^ntf:(.+)$/, async (ctx) => {
    const channel = await getUserChannel(ctx.from.id, ctx.match[1]);
    if (!channel) {
      await ctx.answerCallbackQuery({ text: ctx.dict.common.channelUnavailable });
      return;
    }

    const tgUserId = ctx.from.id;
    const isOn = await toggleSubscription(channel.id, tgUserId);
    await ctx.answerCallbackQuery({ text: ctx.dict.alerts.toggled(channel.title, isOn) });

    const channels = await getUserActiveChannels(tgUserId);
    await ctx
      .editMessageReplyMarkup({ reply_markup: await buildMenu(ctx.dict, tgUserId, channels) })
      .catch(() => {
        // markup may be unchanged or the message too old; the toggle itself already applied
      });
  });
}
