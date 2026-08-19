import type { Bot } from 'grammy';
import type { BotContext } from '../context';
import { getDict, type Lang } from '../i18n';
import { setUserLang } from '../i18n/user-lang';
import { CB, languageMenu } from '../menus';
import { safeEdit } from '../ui';
import { languageCard, languageChangedCard } from '../views/home-view';

export function registerLanguage(bot: Bot<BotContext>): void {
  bot.command('language', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    await ctx.reply(languageCard(ctx.dict, ctx.lang), {
      parse_mode: 'HTML',
      reply_markup: languageMenu(ctx.dict, ctx.lang),
    });
  });

  bot.callbackQuery(CB.goLanguage, async (ctx) => {
    await ctx.answerCallbackQuery();
    await safeEdit(ctx, languageCard(ctx.dict, ctx.lang), languageMenu(ctx.dict, ctx.lang));
  });

  bot.callbackQuery(/^lang:set:(en|ru)$/, async (ctx) => {
    const lang = ctx.match[1] as Lang;
    // Users who never connected a channel have no row yet, so this may create one.
    await setUserLang(ctx.from.id, lang);

    // Confirm in the language that was just picked, not the one the update arrived in.
    const dict = getDict(lang);
    await ctx.answerCallbackQuery();
    await safeEdit(ctx, languageChangedCard(dict, lang), languageMenu(dict, lang));
  });
}
