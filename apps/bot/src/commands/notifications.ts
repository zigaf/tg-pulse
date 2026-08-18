import type { Bot } from 'grammy';
import { notificationsMenu } from '../menus';
import { isSubscribed, toggleSubscription } from '../notifications';
import { getUserActiveChannels, getUserChannel } from '../queries';
import { texts } from '../texts';

export function registerNotifications(bot: Bot): void {
  bot.command('notifications', async (ctx) => {
    if (ctx.chat.type !== 'private' || !ctx.from) return;

    const channels = await getUserActiveChannels(ctx.from.id);
    if (channels.length === 0) {
      await ctx.reply(texts.common.noChannels);
      return;
    }

    const tgUserId = ctx.from.id;
    await ctx.reply(texts.notifications.header, {
      parse_mode: 'HTML',
      reply_markup: notificationsMenu(channels, (channelId) => isSubscribed(channelId, tgUserId)),
    });
  });

  bot.callbackQuery(/^ntf:(.+)$/, async (ctx) => {
    const channel = await getUserChannel(ctx.from.id, ctx.match[1]);
    if (!channel) {
      await ctx.answerCallbackQuery({ text: texts.common.channelUnavailable });
      return;
    }

    const tgUserId = ctx.from.id;
    const isOn = toggleSubscription(channel.id, tgUserId);
    await ctx.answerCallbackQuery({ text: texts.notifications.toggled(channel.title, isOn) });

    const channels = await getUserActiveChannels(tgUserId);
    await ctx
      .editMessageReplyMarkup({
        reply_markup: notificationsMenu(channels, (channelId) => isSubscribed(channelId, tgUserId)),
      })
      .catch(() => {
        // markup may be unchanged or the message too old; the toggle itself already applied
      });
  });
}
