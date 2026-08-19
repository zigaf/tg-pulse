import type { Bot } from 'grammy';
import type { BotContext } from '../context';
import { helpMenu } from '../menus';
import { helpCard } from '../views/home-view';

export function registerHelp(bot: Bot<BotContext>): void {
  bot.command('help', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    await ctx.reply(helpCard(ctx.dict), {
      parse_mode: 'HTML',
      reply_markup: helpMenu(ctx.dict),
      link_preview_options: { is_disabled: true },
    });
  });
}
