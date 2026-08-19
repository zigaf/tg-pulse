import type { Bot } from 'grammy';
import { getPrisma } from '@tgpulse/db';
import { getEntitlements } from '../billing';
import type { BotContext } from '../context';
import { billingMenu, CB, noChannelsMenu } from '../menus';
import { getUserWorkspaceId } from '../queries';
import { getWorkspaceUsage } from '../quota';
import { safeEdit } from '../ui';
import { billingCard, noWorkspaceCard } from '../views/billing-view';

const prisma = getPrisma();

/** Enough history to recognise the last charges without turning the card into a ledger. */
const PAYMENTS_LIMIT = 5;

async function showBilling(ctx: BotContext, mode: 'reply' | 'edit'): Promise<void> {
  if (!ctx.from) return;

  const workspaceId = await getUserWorkspaceId(ctx.from.id);
  if (!workspaceId) {
    await ctx.reply(noWorkspaceCard(ctx.dict), {
      parse_mode: 'HTML',
      reply_markup: noChannelsMenu(ctx.dict, ctx.me.username),
    });
    return;
  }

  const [entitlements, usage, payments] = await Promise.all([
    getEntitlements(workspaceId),
    getWorkspaceUsage(workspaceId),
    prisma.paymentEvent.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: PAYMENTS_LIMIT,
    }),
  ]);

  const text = billingCard(ctx.dict, entitlements, usage, payments);
  const keyboard = billingMenu(ctx.dict);

  if (mode === 'edit') {
    await safeEdit(ctx, text, keyboard);
    return;
  }
  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
    link_preview_options: { is_disabled: true },
  });
}

export function registerBilling(bot: Bot<BotContext>): void {
  bot.command('billing', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    await showBilling(ctx, 'reply');
  });

  // Back from the plans screen: the same message becomes the billing overview.
  bot.callbackQuery(CB.goBilling, async (ctx) => {
    await ctx.answerCallbackQuery();
    await showBilling(ctx, 'edit');
  });
}
