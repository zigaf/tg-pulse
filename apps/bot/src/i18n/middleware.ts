import type { Middleware } from 'grammy';
import type { BotContext } from '../context';
import { DEFAULT_LANG, getDict, langFromCode, type Lang } from './index';
import { getUserLang } from './user-lang';

/**
 * Resolves the locale once per update and puts it on the context.
 * Register before any handler: everything downstream reads ctx.dict.
 */
export function withDict(): Middleware<BotContext> {
  return async (ctx, next) => {
    ctx.lang = await resolveLang(ctx);
    ctx.dict = getDict(ctx.lang);
    await next();
  };
}

async function resolveLang(ctx: BotContext): Promise<Lang> {
  const from = ctx.from;
  if (!from) return DEFAULT_LANG;

  // Only dialog updates justify a lookup. Join and leave traffic runs at channel
  // volume and never renders a dictionary, so it stays on the reported code.
  const isDialog = ctx.callbackQuery !== undefined || ctx.chat?.type === 'private';
  if (!isDialog) return langFromCode(from.language_code) ?? DEFAULT_LANG;

  return getUserLang(from.id, from.language_code);
}
