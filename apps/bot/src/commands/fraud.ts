import type { Bot, InlineKeyboard } from 'grammy';
import type { Channel } from '@tgpulse/db';
import type { BotContext } from '../context';
import { analyzeChannelLinks, analyzeLink } from '../fraud';
import type { Dict } from '../i18n';
import { backToFraudLinksMenu, CB, fraudChannelPickerMenu, fraudLinksMenu } from '../menus';
import { getUserActiveChannels, getUserChannel, getUserLink } from '../queries';
import { checkFraudReportAccess } from '../quota';
import { safeEdit } from '../ui';
import { fraudLinkButton, fraudLinksCard, fraudPickChannelCard, fraudReportCard } from '../views/fraud-view';
import { editNoChannels, replyNoChannels } from './empty-states';
import { editUpsell } from './upsell';

/** Newest links only: older seedings are already settled and each one costs a few queries. */
const FRAUD_LINKS_LIMIT = 8;

async function buildLinksView(
  dict: Dict,
  channel: Channel,
): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const reports = await analyzeChannelLinks(channel.id, FRAUD_LINKS_LIMIT);
  return {
    text: fraudLinksCard(dict, channel.title, reports),
    keyboard: fraudLinksMenu(
      dict,
      reports.map((report) => ({ linkId: report.linkId, title: fraudLinkButton(dict, report) })),
    ),
  };
}

export function registerFraud(bot: Bot<BotContext>): void {
  bot.command('fraud', async (ctx) => {
    if (ctx.chat.type !== 'private' || !ctx.from) return;

    const channels = await getUserActiveChannels(ctx.from.id);
    if (channels.length === 0) {
      await replyNoChannels(ctx);
      return;
    }
    await ctx.reply(fraudPickChannelCard(ctx.dict), {
      parse_mode: 'HTML',
      reply_markup: fraudChannelPickerMenu(ctx.dict, channels),
    });
  });

  bot.callbackQuery(CB.goFraud, async (ctx) => {
    await ctx.answerCallbackQuery();
    const channels = await getUserActiveChannels(ctx.from.id);
    if (channels.length === 0) {
      await editNoChannels(ctx);
      return;
    }
    await safeEdit(ctx, fraudPickChannelCard(ctx.dict), fraudChannelPickerMenu(ctx.dict, channels));
  });

  bot.callbackQuery(/^fr:ch:(.+)$/, async (ctx) => {
    const channel = await getUserChannel(ctx.from.id, ctx.match[1]);
    if (!channel) {
      await ctx.answerCallbackQuery({ text: ctx.dict.common.channelUnavailable });
      return;
    }
    await ctx.answerCallbackQuery();
    const view = await buildLinksView(ctx.dict, channel);
    await safeEdit(ctx, view.text, view.keyboard);
  });

  bot.callbackQuery(/^fr:link:(.+)$/, async (ctx) => {
    const link = await getUserLink(ctx.from.id, ctx.match[1]);
    if (!link) {
      await ctx.answerCallbackQuery({ text: ctx.dict.fraud.linkUnavailable });
      return;
    }

    // The channel is needed for the breadcrumb; it also re-checks access cheaply.
    const [report, channel] = await Promise.all([
      analyzeLink(link.id),
      getUserChannel(ctx.from.id, link.channelId),
    ]);
    if (!report || !channel) {
      await ctx.answerCallbackQuery({ text: ctx.dict.fraud.linkUnavailable });
      return;
    }

    // FREE gets the full report for the newest link only; the rest is an upsell.
    const gate = await checkFraudReportAccess(channel, link.id);
    if (!gate.allowed) {
      await ctx.answerCallbackQuery();
      await editUpsell(ctx, gate.plan, { kind: 'fraud' });
      return;
    }

    await ctx.answerCallbackQuery();
    await safeEdit(
      ctx,
      fraudReportCard(ctx.dict, report, channel.title),
      backToFraudLinksMenu(ctx.dict, link.channelId),
    );
  });
}
