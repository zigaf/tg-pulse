import type { Context } from 'grammy';
import type { Dict, Lang } from './i18n';

/**
 * grammY context carrying the locale resolved once per update by withDict().
 * Handlers read ctx.dict instead of touching the DB for the language again.
 */
export type BotContext = Context & { dict: Dict; lang: Lang };
