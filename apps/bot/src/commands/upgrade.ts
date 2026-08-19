import { GrammyError, type Bot } from 'grammy';
import {
  PLANS,
  STARS_CURRENCY,
  SUBSCRIPTION_PERIOD_SECONDS,
  applySuccessfulPayment,
  buildInvoicePayload,
  getEntitlements,
  isPaidPlan,
  validateInvoicePayload,
  type PaidPlan,
} from '../billing';
import type { BotContext } from '../context';
import { CB, noChannelsMenu, paidMenu, payMenu, plansMenu } from '../menus';
import { getUserWorkspaceId, isWorkspaceMember } from '../queries';
import { getWorkspaceUsage } from '../quota';
import { safeEdit } from '../ui';
import {
  invoiceCard,
  noWorkspaceCard,
  paymentSuccessCard,
  planOptions,
  plansCard,
} from '../views/billing-view';

/** Deep link from the web billing page: t.me/<bot>?start=upgrade_<workspaceId>. */
const DEEP_LINK_PREFIX = 'upgrade_';

export function upgradeDeepLinkWorkspaceId(payload: string): string | null {
  return payload.startsWith(DEEP_LINK_PREFIX) ? payload.slice(DEEP_LINK_PREFIX.length) : null;
}

/**
 * The workspace the dialog bills. A requested id is honoured only for its members,
 * so a guessed deep link silently falls back to the user's own workspace.
 */
async function resolveWorkspaceId(tgUserId: number, requested: string | null): Promise<string | null> {
  if (requested && (await isWorkspaceMember(tgUserId, requested))) return requested;
  return getUserWorkspaceId(tgUserId);
}

/** The plans screen: current usage plus every plan the workspace can move to. */
export async function showPlans(
  ctx: BotContext,
  requested: string | null,
  mode: 'reply' | 'edit',
): Promise<void> {
  if (!ctx.from) return;

  const workspaceId = await resolveWorkspaceId(ctx.from.id, requested);
  if (!workspaceId) {
    await ctx.reply(noWorkspaceCard(ctx.dict), {
      parse_mode: 'HTML',
      reply_markup: noChannelsMenu(ctx.dict, ctx.me.username),
    });
    return;
  }

  const [entitlements, usage] = await Promise.all([
    getEntitlements(workspaceId),
    getWorkspaceUsage(workspaceId),
  ]);
  const text = plansCard(ctx.dict, entitlements, usage);
  const keyboard = plansMenu(ctx.dict, planOptions(ctx.dict), workspaceId);

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

/** Telegram rejects subscription_period on bots that are not enabled for recurring Stars. */
function isRecurringUnsupported(error: unknown): boolean {
  return error instanceof GrammyError && /subscription/i.test(error.description);
}

async function sendInvoice(ctx: BotContext, plan: PaidPlan, workspaceId: string): Promise<void> {
  const { dict } = ctx;
  const definition = PLANS[plan];
  const name = dict.billing.planName[plan];
  const title = dict.billing.invoiceTitle(name);
  const description = dict.billing.invoiceDescription(name, definition.periodDays);
  const payload = buildInvoicePayload(plan, workspaceId);
  const prices = [{ label: name, amount: definition.priceXtr }];

  try {
    const url = await ctx.api.createInvoiceLink(title, description, payload, '', STARS_CURRENCY, prices, {
      subscription_period: SUBSCRIPTION_PERIOD_SECONDS,
    });
    await ctx.reply(invoiceCard(dict, plan), {
      parse_mode: 'HTML',
      reply_markup: payMenu(dict, url),
      link_preview_options: { is_disabled: true },
    });
    return;
  } catch (error) {
    if (!isRecurringUnsupported(error)) {
      console.error('Invoice link creation failed', error);
      await ctx.reply(dict.billing.invoiceFailed);
      return;
    }
    console.warn('Recurring Stars unavailable, falling back to a one-off invoice', error);
  }

  // Fallback: a plain invoice for one period, renewed manually from /upgrade.
  const chatId = ctx.chat?.id ?? ctx.from?.id;
  if (chatId === undefined) return;
  try {
    await ctx.api.sendInvoice(chatId, title, description, payload, STARS_CURRENCY, prices);
  } catch (error) {
    console.error('Invoice send failed', error);
    await ctx.reply(dict.billing.invoiceFailed);
  }
}

export function registerUpgrade(bot: Bot<BotContext>): void {
  bot.command('upgrade', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    await showPlans(ctx, null, 'reply');
  });

  // Opened from /billing or from an upsell card: the same message becomes the plans screen.
  bot.callbackQuery(CB.goUpgrade, async (ctx) => {
    await ctx.answerCallbackQuery();
    await showPlans(ctx, null, 'edit');
  });

  bot.callbackQuery(/^bill:buy:([A-Z]+):(.+)$/, async (ctx) => {
    const [, plan, workspaceId] = ctx.match;
    if (!isPaidPlan(plan) || !(await isWorkspaceMember(ctx.from.id, workspaceId))) {
      await ctx.answerCallbackQuery({ text: ctx.dict.billing.invalidPayload });
      return;
    }
    await ctx.answerCallbackQuery();
    await sendInvoice(ctx, plan, workspaceId);
  });

  // Last gate before the charge: the payload is re-validated against the payer.
  bot.on('pre_checkout_query', async (ctx) => {
    const query = ctx.preCheckoutQuery;
    const parsed = await validateInvoicePayload(query.invoice_payload, ctx.from.id);
    const isExpectedCharge =
      parsed !== null &&
      query.currency === STARS_CURRENCY &&
      query.total_amount === PLANS[parsed.plan].priceXtr;

    if (!isExpectedCharge) {
      await ctx.answerPreCheckoutQuery(false, ctx.dict.billing.invalidPayload);
      return;
    }
    await ctx.answerPreCheckoutQuery(true);
  });

  bot.on('message:successful_payment', async (ctx) => {
    if (!ctx.from) return;
    const payment = ctx.message.successful_payment;

    const parsed = await validateInvoicePayload(payment.invoice_payload, ctx.from.id);
    if (!parsed) {
      console.error(`Paid invoice with an unusable payload: ${payment.telegram_payment_charge_id}`);
      await ctx.reply(ctx.dict.billing.invalidPayload);
      return;
    }

    const result = await applySuccessfulPayment({
      providerPaymentId: payment.telegram_payment_charge_id,
      workspaceId: parsed.workspaceId,
      plan: parsed.plan,
      amount: payment.total_amount,
      currency: payment.currency,
      periodDays: PLANS[parsed.plan].periodDays,
      payerTgId: ctx.from.id,
      payload: payment.invoice_payload,
      providerRef: payment.is_recurring ? payment.telegram_payment_charge_id : undefined,
    });

    // A replayed update must not send a second receipt.
    if (result.alreadyProcessed) return;

    await ctx.reply(
      paymentSuccessCard(ctx.dict, result.subscription.plan, result.subscription.currentPeriodEnd),
      { parse_mode: 'HTML', reply_markup: paidMenu(ctx.dict) },
    );
  });
}
