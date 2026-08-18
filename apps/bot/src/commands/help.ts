import type { Bot } from 'grammy';
import { helpMenu } from '../menus';
import { texts } from '../texts';

export function registerHelp(bot: Bot): void {
  bot.command('help', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    await ctx.reply(texts.help(), {
      parse_mode: 'HTML',
      reply_markup: helpMenu(),
      link_preview_options: { is_disabled: true },
    });
  });
}
