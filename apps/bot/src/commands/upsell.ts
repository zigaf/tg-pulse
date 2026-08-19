import type { Plan } from '@tgpulse/db';
import type { BotContext } from '../context';
import { upsellMenu } from '../menus';
import { safeEdit } from '../ui';
import { upsellCard, type UpsellReason } from '../views/billing-view';

/**
 * A blocked action never ends in a bare error: the user gets what stopped them,
 * which plan lifts it and a button that opens the plans screen.
 */
export async function replyUpsell(ctx: BotContext, plan: Plan, reason: UpsellReason): Promise<void> {
  await ctx.reply(upsellCard(ctx.dict, plan, reason), {
    parse_mode: 'HTML',
    reply_markup: upsellMenu(ctx.dict),
  });
}

export async function editUpsell(ctx: BotContext, plan: Plan, reason: UpsellReason): Promise<void> {
  await safeEdit(ctx, upsellCard(ctx.dict, plan, reason), upsellMenu(ctx.dict));
}
