import type { Bot } from 'grammy';
import type { Channel } from '@tgpulse/db';
import { notificationsMenu } from '../menus';
import { getSubscribedChannelIds, toggleSubscription } from '../notifications';
import { getUserActiveChannels, getUserChannel } from '../queries';
import { texts } from '../texts';

async function buildMenu(tgUserId: number, channels: Channel[]) {
  const subscribed = await getSubscribedChannelIds(
    tgUserId,
    channels.map((channel) => channel.id),
  );
  return notificationsMenu(channels, subscribed);
}

export function registerNotifications(bot: Bot): void {
  bot.command('notifications', async (ctx) => {
    if (ctx.chat.type !== 'private' || !ctx.from) return;

    const channels = await getUserActiveChannels(ctx.from.id);
    if (channels.length === 0) {
      await ctx.reply(texts.common.noChannels);
      return;
    }

    await ctx.reply(texts.notifications.header, {
      parse_mode: 'HTML',
      reply_markup: await buildMenu(ctx.from.id, channels),
    });
  });

  bot.callbackQuery(/^ntf:(.+)$/, async (ctx) => {
    const channel = await getUserChannel(ctx.from.id, ctx.match[1]);
    if (!channel) {
      await ctx.answerCallbackQuery({ text: texts.common.channelUnavailable });
      return;
    }

    const tgUserId = ctx.from.id;
    const isOn = await toggleSubscription(channel.id, tgUserId);
    await ctx.answerCallbackQuery({ text: texts.notifications.toggled(channel.title, isOn) });

    const channels = await getUserActiveChannels(tgUserId);
    await ctx
      .editMessageReplyMarkup({ reply_markup: await buildMenu(tgUserId, channels) })
      .catch(() => {
        // markup may be unchanged or the message too old; the toggle itself already applied
      });
  });
}
