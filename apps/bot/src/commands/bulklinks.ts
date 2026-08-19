import { GrammyError, InputFile, type Bot } from 'grammy';
import { getPrisma, BotStatus, type Channel } from '@tgpulse/db';
import type { BotContext } from '../context';
import { csvDocument, fileSlug } from '../csv';
import { isoDate } from '../format';
import { createTrackedLink, goUrl, inviteLinkName } from '../links';
import { CB, cancelMenu, channelPickerMenu, postCreateMenu } from '../menus';
import { getUserActiveChannels, getUserChannel } from '../queries';
import { checkBulkLinkQuota } from '../quota';
import { clearState, getState, setState } from '../state';
import {
  bulkAskNamesCard,
  bulkLinkBlocks,
  bulkPickChannelCard,
  bulkResultCard,
  type BulkLine,
} from '../views/bulklinks-view';
import { replyNoChannels } from './empty-states';
import { editUpsell, replyUpsell } from './upsell';

/**
 * Batch creation for a media plan: one placement name per line, one tracking link each,
 * answered with a copyable block and a CSV to paste into an ad manager.
 */

const prisma = getPrisma();

/** One message may carry a whole media plan, but not an unbounded one. */
const MAX_NAMES = 50;
/** Telegram throttles createChatInviteLink, so the batch runs politely and serially. */
const CREATE_DELAY_MS = 350;

/** Machine-readable header: never localised, an ad manager reads this file. */
const CSV_HEADER = ['label', 'url', 'invite_link'];

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface BatchResult {
  lines: BulkLine[];
  /** Set when the run was interrupted; everything before it is created and live. */
  stoppedReason: string | null;
  inviteLinks: (string | null)[];
}

/**
 * Create the links one by one. A Telegram or database failure ends the run instead of
 * hammering the API: what was created stays, and the caller reports how far it got.
 */
async function runBatch(ctx: BotContext, channel: Channel, labels: string[]): Promise<BatchResult> {
  const lines: BulkLine[] = [];
  const inviteLinks: (string | null)[] = [];

  for (const [index, label] of labels.entries()) {
    if (index > 0) await sleep(CREATE_DELAY_MS);

    let inviteLink: string;
    try {
      const invite = await ctx.api.createChatInviteLink(Number(channel.tgChatId), {
        name: inviteLinkName(label),
      });
      inviteLink = invite.invite_link;
    } catch (error) {
      const description = error instanceof GrammyError ? error.description : 'unexpected error';
      return { lines, inviteLinks, stoppedReason: description };
    }

    const link = await createTrackedLink({ channelId: channel.id, label, inviteLink });
    if (!link) {
      return { lines, inviteLinks, stoppedReason: ctx.dict.bulk.saveFailedReason };
    }

    lines.push({ label, url: goUrl(link.slug) });
    inviteLinks.push(inviteLink);
  }

  return { lines, inviteLinks, stoppedReason: null };
}

async function sendResults(
  ctx: BotContext,
  channel: Channel,
  result: BatchResult,
  summary: { skippedQuota: number; planName: string; limit: number; skippedBatch: number },
): Promise<void> {
  await ctx.reply(
    bulkResultCard(ctx.dict, {
      channelTitle: channel.title,
      created: result.lines.length,
      skippedQuota: summary.skippedQuota,
      planName: summary.planName,
      limit: summary.limit,
      skippedBatch: summary.skippedBatch,
      batchMax: MAX_NAMES,
      stoppedReason: result.stoppedReason,
    }),
    { parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
  );

  if (result.lines.length === 0) return;

  for (const block of bulkLinkBlocks(result.lines)) {
    await ctx.reply(block, { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
  }

  const csv = csvDocument(
    CSV_HEADER,
    result.lines.map((line, index) => [line.label, line.url, result.inviteLinks[index]]),
  );
  const fileName = `${fileSlug(channel.title, 'channel')}-links-${isoDate(new Date())}.csv`;

  await ctx.replyWithDocument(new InputFile(Buffer.from(csv, 'utf8'), fileName), {
    reply_markup: postCreateMenu(ctx.dict),
  });
}

export function registerBulklinks(bot: Bot<BotContext>): void {
  bot.command('bulklinks', async (ctx) => {
    if (ctx.chat.type !== 'private' || !ctx.from) return;

    const channels = await getUserActiveChannels(ctx.from.id);
    if (channels.length === 0) {
      await replyNoChannels(ctx);
      return;
    }
    await ctx.reply(bulkPickChannelCard(ctx.dict), {
      parse_mode: 'HTML',
      reply_markup: channelPickerMenu(ctx.dict, channels, CB.blPick),
    });
  });

  bot.callbackQuery(/^bl:pick:(.+)$/, async (ctx) => {
    const channel = await getUserChannel(ctx.from.id, ctx.match[1]);
    if (!channel) {
      await ctx.answerCallbackQuery({ text: ctx.dict.common.channelUnavailable });
      return;
    }

    // A channel with no room left never reaches the "send your names" step.
    const gate = await checkBulkLinkQuota(channel);
    if (!gate.allowed) {
      await ctx.answerCallbackQuery();
      await editUpsell(ctx, gate.plan, { kind: gate.reason, limit: gate.limit });
      return;
    }

    setState(ctx.from.id, { step: 'awaiting_bulk_names', channelId: channel.id });
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(bulkAskNamesCard(ctx.dict, channel.title, MAX_NAMES), {
      parse_mode: 'HTML',
      reply_markup: cancelMenu(ctx.dict),
    });
  });

  bot.on('message:text', async (ctx, next) => {
    if (ctx.chat.type !== 'private' || ctx.message.text.startsWith('/')) return next();

    const state = getState(ctx.from.id);
    if (!state || state.step !== 'awaiting_bulk_names') return next();

    const names = ctx.message.text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (names.length === 0) {
      await ctx.reply(ctx.dict.bulk.empty, { reply_markup: cancelMenu(ctx.dict) });
      return;
    }

    const channel = await prisma.channel.findUnique({ where: { id: state.channelId } });
    if (!channel || channel.botStatus !== BotStatus.ACTIVE) {
      clearState(ctx.from.id);
      await ctx.reply(ctx.dict.newlink.channelGone);
      return;
    }

    const gate = await checkBulkLinkQuota(channel);
    if (!gate.allowed) {
      clearState(ctx.from.id);
      await replyUpsell(ctx, gate.plan, { kind: gate.reason, limit: gate.limit });
      return;
    }

    const batch = names.slice(0, MAX_NAMES);
    const planned = gate.remaining === null ? batch : batch.slice(0, gate.remaining);

    // Cleared before the run: it takes seconds, and a second message must not start a twin.
    clearState(ctx.from.id);
    await ctx.reply(ctx.dict.bulk.working(planned.length));

    const result = await runBatch(ctx, channel, planned);
    await sendResults(ctx, channel, result, {
      skippedQuota: batch.length - planned.length,
      planName: ctx.dict.billing.planName[gate.plan],
      limit: gate.limit ?? 0,
      skippedBatch: names.length - batch.length,
    });
  });
}
