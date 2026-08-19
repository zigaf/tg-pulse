import { randomBytes } from 'node:crypto';
import { GrammyError, type Bot } from 'grammy';
import { getPrisma, BotStatus } from '@tgpulse/db';
import { config } from '../config';
import type { BotContext } from '../context';
import { CB, cancelMenu, channelPickerMenu, postCreateMenu } from '../menus';
import { getUserActiveChannels, getUserChannel } from '../queries';
import { clearState, getState, setState } from '../state';
import { askLabelCard, createdCard, pickChannelCard } from '../views/newlink-view';
import { replyNoChannels } from './empty-states';

const prisma = getPrisma();

const INVITE_LINK_NAME_MAX = 32; // Telegram limit for invite link names
const SLUG_LENGTH = 8;
const SLUG_MAX_ATTEMPTS = 5;

/** Random url-safe slug: 6 random bytes -> exactly 8 base64url characters. */
function generateSlug(): string {
  return randomBytes(6).toString('base64url').slice(0, SLUG_LENGTH);
}

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

  // Label received -> create the invite link and the TrackedLink
  bot.on('message:text', async (ctx, next) => {
    if (ctx.chat.type !== 'private' || ctx.message.text.startsWith('/')) return next();

    const state = getState(ctx.from.id);
    if (!state || state.step !== 'awaiting_label') return next();

    const label = ctx.message.text.trim();
    if (!label) {
      await ctx.reply(ctx.dict.newlink.emptyLabel, { reply_markup: cancelMenu(ctx.dict) });
      return;
    }

    const channel = await prisma.channel.findUnique({ where: { id: state.channelId } });
    if (!channel || channel.botStatus !== BotStatus.ACTIVE) {
      clearState(ctx.from.id);
      await ctx.reply(ctx.dict.newlink.channelGone);
      return;
    }

    let inviteLink: string;
    try {
      const invite = await ctx.api.createChatInviteLink(Number(channel.tgChatId), {
        name: label.slice(0, INVITE_LINK_NAME_MAX),
      });
      inviteLink = invite.invite_link;
    } catch (error) {
      clearState(ctx.from.id);
      const description = error instanceof GrammyError ? error.description : 'unexpected error';
      await ctx.reply(ctx.dict.newlink.createFailed(description, channel.title));
      return;
    }

    const trackedLink = await createTrackedLink(channel.id, label, inviteLink);
    clearState(ctx.from.id);

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
        label,
        goUrl: `${config.goBaseUrl}/l/${trackedLink.slug}`,
        inviteLink,
        sourceCount,
      }),
      {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: postCreateMenu(ctx.dict),
      },
    );
  });
}

async function createTrackedLink(channelId: string, label: string, inviteLink: string) {
  for (let attempt = 0; attempt < SLUG_MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.trackedLink.create({
        data: { slug: generateSlug(), channelId, label, inviteLink },
      });
    } catch (error) {
      // P2002 = unique constraint violation (slug collision) -> retry with a new slug
      const isSlugCollision =
        typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
      if (!isSlugCollision) throw error;
    }
  }
  return null;
}
