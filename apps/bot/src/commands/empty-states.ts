import type { BotContext } from '../context';
import { noChannelsMenu } from '../menus';
import { safeEdit } from '../ui';
import { noChannelsCard } from '../views/home-view';

/**
 * Every screen needs at least one connected channel, so the "nothing here yet"
 * state is one instruction plus the button that fixes it, in both directions:
 * a fresh reply for commands, an in-place edit for callbacks.
 */
export async function replyNoChannels(ctx: BotContext): Promise<void> {
  await ctx.reply(noChannelsCard(ctx.dict), {
    parse_mode: 'HTML',
    reply_markup: noChannelsMenu(ctx.dict, ctx.me.username),
  });
}

export async function editNoChannels(ctx: BotContext): Promise<void> {
  await safeEdit(ctx, noChannelsCard(ctx.dict), noChannelsMenu(ctx.dict, ctx.me.username));
}
