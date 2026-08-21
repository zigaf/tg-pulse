import type { Bot } from 'grammy';
import type { BotContext } from './context';
import { DEFAULT_LANG, getDict } from './i18n';
import { reportError } from './sentry';

/**
 * Resilience layer. Register LAST so it only catches what no other handler claimed:
 * - unknown text or commands in private chat -> /help hint
 * - unmatched callback queries -> answered so the client never shows a spinner
 * - any thrown error -> logged plus a polite reply
 */
export function registerFallback(bot: Bot<BotContext>): void {
  bot.on('message:text', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    await ctx.reply(ctx.dict.common.unknownInput);
  });

  bot.on('callback_query', async (ctx) => {
    await ctx.answerCallbackQuery();
  });

  bot.catch((err) => {
    console.error('Bot error while handling update', err.error);
    reportError(err.error, { updateId: err.ctx.update.update_id, chatId: err.ctx.chat?.id });
    const ctx = err.ctx;
    if (ctx.callbackQuery) {
      void ctx.answerCallbackQuery().catch(() => {});
    }
    if (ctx.chat?.type === 'private') {
      // The locale middleware may be exactly what failed, so fall back to the default.
      const dict = ctx.dict ?? getDict(DEFAULT_LANG);
      void ctx.reply(dict.common.somethingWrong).catch(() => {});
    }
  });
}
