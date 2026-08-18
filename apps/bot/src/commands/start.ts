import type { Bot } from 'grammy';
import { startMenu } from '../menus';
import { texts } from '../texts';

export function registerStart(bot: Bot): void {
  // ctx.match may carry a deep-link payload (t.me/<bot>?start=<payload>); the card
  // is the right answer for any payload, so we accept and ignore it safely.
  bot.command('start', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    await ctx.reply(texts.start.intro, {
      parse_mode: 'HTML',
      reply_markup: startMenu(ctx.me.username),
      link_preview_options: { is_disabled: true },
    });
  });
}
