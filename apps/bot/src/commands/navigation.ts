import type { Bot } from 'grammy';
import type { BotContext } from '../context';
import { CB } from '../menus';

/** Navigation actions shared by every screen. */
export function registerNavigation(bot: Bot<BotContext>): void {
  bot.callbackQuery(CB.close, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.deleteMessage().catch(() => {
      // Telegram refuses to delete messages older than 48 hours; the screen stays.
    });
  });
}
