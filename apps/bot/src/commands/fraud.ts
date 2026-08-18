import { GrammyError, type Bot, type Context, type InlineKeyboard } from 'grammy';
import type { Channel } from '@tgpulse/db';
import { analyzeChannelLinks, analyzeLink } from '../fraud';
import { backToFraudLinksMenu, CB, fraudChannelPickerMenu, fraudLinksMenu } from '../menus';
import { getUserActiveChannels, getUserChannel, getUserLink } from '../queries';
import { texts } from '../texts';

/** Newest links only: older seedings are already settled and each one costs a few queries. */
const FRAUD_LINKS_LIMIT = 8;
const NOT_MODIFIED = 'message is not modified';

/** Edit that tolerates "message is not modified" (e.g. re-opening the same view). */
async function safeEdit(ctx: Context, text: string, replyMarkup: InlineKeyboard): Promise<void> {
  try {
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: replyMarkup });
  } catch (error) {
    if (error instanceof GrammyError && error.description.includes(NOT_MODIFIED)) return;
    throw error;
  }
}

async function buildLinksView(channel: Channel): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const reports = await analyzeChannelLinks(channel.id, FRAUD_LINKS_LIMIT);
  if (reports.length === 0) {
    return {
      text: [texts.fraud.linksHeader(channel.title), '', texts.fraud.noLinks].join('\n'),
      keyboard: fraudLinksMenu([]),
    };
  }

  return {
    text: texts.fraud.linksHeader(channel.title),
    keyboard: fraudLinksMenu(
      reports.map((report) => ({ linkId: report.linkId, title: texts.fraud.linkButton(report) })),
    ),
  };
}

export function registerFraud(bot: Bot): void {
  bot.command('fraud', async (ctx) => {
    if (ctx.chat.type !== 'private' || !ctx.from) return;

    const channels = await getUserActiveChannels(ctx.from.id);
    if (channels.length === 0) {
      await ctx.reply(texts.common.noChannels);
      return;
    }
    await ctx.reply(texts.fraud.pickChannel, {
      parse_mode: 'HTML',
      reply_markup: fraudChannelPickerMenu(channels),
    });
  });

  bot.callbackQuery(CB.goFraud, async (ctx) => {
    await ctx.answerCallbackQuery();
    const channels = await getUserActiveChannels(ctx.from.id);
    if (channels.length === 0) {
      await ctx.reply(texts.common.noChannels);
      return;
    }
    await safeEdit(ctx, texts.fraud.pickChannel, fraudChannelPickerMenu(channels));
  });

  bot.callbackQuery(/^fr:ch:(.+)$/, async (ctx) => {
    const channel = await getUserChannel(ctx.from.id, ctx.match[1]);
    if (!channel) {
      await ctx.answerCallbackQuery({ text: texts.common.channelUnavailable });
      return;
    }
    await ctx.answerCallbackQuery();
    const view = await buildLinksView(channel);
    await safeEdit(ctx, view.text, view.keyboard);
  });

  bot.callbackQuery(/^fr:link:(.+)$/, async (ctx) => {
    const link = await getUserLink(ctx.from.id, ctx.match[1]);
    if (!link) {
      await ctx.answerCallbackQuery({ text: texts.fraud.linkUnavailable });
      return;
    }

    const report = await analyzeLink(link.id);
    if (!report) {
      await ctx.answerCallbackQuery({ text: texts.fraud.linkUnavailable });
      return;
    }

    await ctx.answerCallbackQuery();
    await safeEdit(ctx, texts.fraud.report(report), backToFraudLinksMenu(link.channelId));
  });
}
