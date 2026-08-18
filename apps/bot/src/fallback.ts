import type { Bot } from 'grammy';
import { texts } from './texts';

/**
 * Resilience layer. Register LAST so it only catches what no other handler claimed:
 * - unknown text or commands in private chat -> /help hint
 * - unmatched callback queries -> answered so the client never shows a spinner
 * - any thrown error -> logged plus a polite reply
 */
export function registerFallback(bot: Bot): void {
  bot.on('message:text', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    await ctx.reply(texts.common.unknownInput);
  });

  bot.on('callback_query', async (ctx) => {
    await ctx.answerCallbackQuery();
  });

  bot.catch((err) => {
    console.error('Bot error while handling update', err.error);
    const ctx = err.ctx;
    if (ctx.callbackQuery) {
      void ctx.answerCallbackQuery().catch(() => {});
    }
    if (ctx.chat?.type === 'private') {
      void ctx.reply(texts.common.somethingWrong).catch(() => {});
    }
  });
}
