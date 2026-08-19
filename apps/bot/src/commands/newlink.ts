import { GrammyError, type Bot } from 'grammy';
import { getPrisma, BotStatus, type Channel } from '@tgpulse/db';
import type { BotContext } from '../context';
import { validatePostUrl } from '../landing-post';
import { createTrackedLink, goUrl, inviteLinkName } from '../links';
import { CB, cancelMenu, channelPickerMenu, linkModeMenu, postCreateMenu, skipMenu } from '../menus';
import { getUserActiveChannels, getUserChannel } from '../queries';
import { checkLinkQuota } from '../quota';
import { clearState, getState, setState } from '../state';
import {
  askBuyerCard,
  askLabelCard,
  askModeCard,
  askPostUrlCard,
  createdCard,
  pickChannelCard,
} from '../views/newlink-view';
import { replyNoChannels } from './empty-states';
import { editUpsell, replyUpsell } from './upsell';

/**
 * Dialog: channel -> label -> destination -> (post URL) -> buyer -> link.
 * Nothing is written before the last step, so a cancelled or expired flow leaves no rows.
 */

const prisma = getPrisma();

/** Entry point of the flow: channel picker or onboarding hint. Used by /newlink and callbacks. */
export async function startNewlinkFlow(ctx: BotContext, tgUserId: number): Promise<void> {
  const channels = await getUserActiveChannels(tgUserId);
  if (channels.length === 0) {
    await replyNoChannels(ctx);
    return;
  }
  await ctx.reply(pickChannelCard(ctx.dict), {
    parse_mode: 'HTML',
    reply_markup: channelPickerMenu(ctx.dict, channels),
  });
}

/** The channel a dialog step refers to, or null once it is gone or lost the bot as admin. */
async function loadDialogChannel(channelId: string): Promise<Channel | null> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  return channel && channel.botStatus === BotStatus.ACTIVE ? channel : null;
}

interface Finalize {
  channelId: string;
  label: string;
  targetPostUrl: string | null;
  buyer: string | null;
}

/** Last step: create what the dialog collected, then show the result card. */
async function finish(ctx: BotContext, tgUserId: number, input: Finalize): Promise<void> {
  clearState(tgUserId);

  const channel = await loadDialogChannel(input.channelId);
  if (!channel) {
    await ctx.reply(ctx.dict.newlink.channelGone);
    return;
  }

  // The dialog may have opened before a downgrade, so the quota is re-checked here.
  const gate = await checkLinkQuota(channel);
  if (!gate.allowed) {
    await replyUpsell(ctx, gate.plan, { kind: gate.reason, limit: gate.limit });
    return;
  }

  // Landing-post links get no invite link: nobody joins through it, so issuing one
  // would only burn an invite slot in the channel.
  let inviteLink: string | null = null;
  if (input.targetPostUrl === null) {
    try {
      const invite = await ctx.api.createChatInviteLink(Number(channel.tgChatId), {
        name: inviteLinkName(input.label),
      });
      inviteLink = invite.invite_link;
    } catch (error) {
      const description = error instanceof GrammyError ? error.description : 'unexpected error';
      await ctx.reply(ctx.dict.newlink.createFailed(description, channel.title));
      return;
    }
  }

  const trackedLink = await createTrackedLink({
    channelId: channel.id,
    label: input.label,
    inviteLink,
    targetPostUrl: input.targetPostUrl,
    buyer: input.buyer,
  });
  if (!trackedLink) {
    await ctx.reply(ctx.dict.newlink.saveFailed);
    return;
  }

  const sourceCount = await prisma.trackedLink.count({
    where: { channelId: channel.id, isRevoked: false },
  });

  await ctx.reply(
    createdCard(ctx.dict, {
      channelTitle: channel.title,
      label: input.label,
      goUrl: goUrl(trackedLink.slug),
      inviteLink,
      targetPostUrl: input.targetPostUrl,
      buyer: input.buyer,
      sourceCount,
    }),
    {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: postCreateMenu(ctx.dict),
    },
  );
}

/** Why a landing-post URL was refused, in the user's words. */
function postUrlError(ctx: BotContext, error: string, channelTitle: string): string {
  switch (error) {
    case 'notTelegram':
      return ctx.dict.newlink.postUrlNotTelegram;
    case 'notAPost':
      return ctx.dict.newlink.postUrlNotAPost;
    case 'noUsername':
      return ctx.dict.newlink.postUrlNoUsername(channelTitle);
    default:
      return ctx.dict.newlink.postUrlOtherChannel(channelTitle);
  }
}

export function registerNewlink(bot: Bot<BotContext>): void {
  bot.command('newlink', async (ctx) => {
    if (ctx.chat.type !== 'private' || !ctx.from) return;
    await startNewlinkFlow(ctx, ctx.from.id);
  });

  bot.callbackQuery(CB.goNewlink, async (ctx) => {
    await ctx.answerCallbackQuery();
    await startNewlinkFlow(ctx, ctx.from.id);
  });

  // Channel picked (from the picker or from the /channels menu) -> ask for a label
  bot.callbackQuery(/^nl:pick:(.+)$/, async (ctx) => {
    const channel = await getUserChannel(ctx.from.id, ctx.match[1]);
    if (!channel) {
      await ctx.answerCallbackQuery({ text: ctx.dict.common.channelUnavailable });
      return;
    }

    // Quotas are enforced before the dialog starts, so nobody types a label for nothing.
    const gate = await checkLinkQuota(channel);
    if (!gate.allowed) {
      await ctx.answerCallbackQuery();
      await editUpsell(ctx, gate.plan, { kind: gate.reason, limit: gate.limit });
      return;
    }

    setState(ctx.from.id, { step: 'awaiting_label', channelId: channel.id });
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(askLabelCard(ctx.dict, channel.title), {
      parse_mode: 'HTML',
      reply_markup: cancelMenu(ctx.dict),
    });
  });

  bot.callbackQuery(CB.nlCancel, async (ctx) => {
    clearState(ctx.from.id);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(ctx.dict.newlink.cancelled).catch(() => {
      // message may be too old to edit; the state is cleared either way
    });
  });

  // Destination picked: a unique invite link, or a post the tracking URL redirects to
  bot.callbackQuery(/^nl:mode:(invite|post)$/, async (ctx) => {
    const state = getState(ctx.from.id);
    if (!state || state.step !== 'awaiting_mode') {
      await ctx.answerCallbackQuery({ text: ctx.dict.newlink.expired });
      return;
    }

    const channel = await loadDialogChannel(state.channelId);
    if (!channel) {
      clearState(ctx.from.id);
      await ctx.answerCallbackQuery({ text: ctx.dict.newlink.channelGone });
      return;
    }
    await ctx.answerCallbackQuery();

    if (ctx.match[1] === 'post') {
      setState(ctx.from.id, { step: 'awaiting_post_url', channelId: state.channelId, label: state.label });
      await ctx.editMessageText(askPostUrlCard(ctx.dict, channel.title), {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: cancelMenu(ctx.dict),
      });
      return;
    }

    setState(ctx.from.id, {
      step: 'awaiting_buyer',
      channelId: state.channelId,
      label: state.label,
      targetPostUrl: null,
    });
    await ctx.editMessageText(askBuyerCard(ctx.dict, channel.title), {
      parse_mode: 'HTML',
      reply_markup: skipMenu(ctx.dict),
    });
  });

  // The buyer step is optional, so skipping is an answer and not an abandoned dialog
  bot.callbackQuery(CB.nlSkipBuyer, async (ctx) => {
    const state = getState(ctx.from.id);
    if (!state || state.step !== 'awaiting_buyer') {
      await ctx.answerCallbackQuery({ text: ctx.dict.newlink.expired });
      return;
    }
    await ctx.answerCallbackQuery();
    await finish(ctx, ctx.from.id, { ...state, buyer: null });
  });

  bot.on('message:text', async (ctx, next) => {
    if (ctx.chat.type !== 'private' || ctx.message.text.startsWith('/')) return next();

    const state = getState(ctx.from.id);
    // Steps of other flows (/bulklinks) belong to their own handler.
    if (!state || state.step === 'awaiting_bulk_names') return next();

    const text = ctx.message.text.trim();

    if (state.step === 'awaiting_buyer') {
      await finish(ctx, ctx.from.id, { ...state, buyer: text.length > 0 ? text : null });
      return;
    }

    if (state.step === 'awaiting_label' && !text) {
      await ctx.reply(ctx.dict.newlink.emptyLabel, { reply_markup: cancelMenu(ctx.dict) });
      return;
    }

    const channel = await loadDialogChannel(state.channelId);
    if (!channel) {
      clearState(ctx.from.id);
      await ctx.reply(ctx.dict.newlink.channelGone);
      return;
    }

    if (state.step === 'awaiting_label') {
      setState(ctx.from.id, { step: 'awaiting_mode', channelId: state.channelId, label: text });
      await ctx.reply(askModeCard(ctx.dict, channel.title), {
        parse_mode: 'HTML',
        reply_markup: linkModeMenu(ctx.dict),
      });
      return;
    }

    // The destination step has no free-text answer, so typing repeats the question
    // instead of dropping the user into the unknown-input hint.
    if (state.step === 'awaiting_mode') {
      await ctx.reply(askModeCard(ctx.dict, channel.title), {
        parse_mode: 'HTML',
        reply_markup: linkModeMenu(ctx.dict),
      });
      return;
    }

    // awaiting_post_url: a refused URL keeps the step open, so the user retypes
    // instead of restarting the whole dialog.
    const checked = validatePostUrl(text, channel);
    if (!checked.ok) {
      await ctx.reply(postUrlError(ctx, checked.error, channel.title), {
        link_preview_options: { is_disabled: true },
        reply_markup: cancelMenu(ctx.dict),
      });
      return;
    }

    setState(ctx.from.id, {
      step: 'awaiting_buyer',
      channelId: state.channelId,
      label: state.label,
      targetPostUrl: checked.url,
    });
    await ctx.reply(askBuyerCard(ctx.dict, channel.title), {
      parse_mode: 'HTML',
      reply_markup: skipMenu(ctx.dict),
    });
  });
}
