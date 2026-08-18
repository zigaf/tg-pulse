import { randomBytes } from 'node:crypto';
import { GrammyError, InlineKeyboard, type Bot } from 'grammy';
import { getPrisma, BotStatus } from '@tgpulse/db';
import { config } from '../config';
import { escapeHtml } from '../format';
import { getUserActiveChannels } from '../queries';
import { clearState, getState, setState } from '../state';

const prisma = getPrisma();

const INVITE_LINK_NAME_MAX = 32; // Telegram limit for invite link names
const SLUG_LENGTH = 8;
const SLUG_MAX_ATTEMPTS = 5;

/** Random url-safe slug: 6 random bytes -> exactly 8 base64url characters. */
function generateSlug(): string {
  return randomBytes(6).toString('base64url').slice(0, SLUG_LENGTH);
}

export function registerNewlink(bot: Bot): void {
  bot.command('newlink', async (ctx) => {
    if (ctx.chat.type !== 'private' || !ctx.from) return;

    const channels = await getUserActiveChannels(ctx.from.id);
    if (channels.length === 0) {
      await ctx.reply(
        [
          'No channels connected yet.',
          '',
          'Add me as an admin to your channel (the "invite users via link" permission is enough), then run /newlink again.',
        ].join('\n'),
      );
      return;
    }

    const keyboard = new InlineKeyboard();
    for (const channel of channels) {
      keyboard.text(channel.title, `nl:${channel.id}`).row();
    }
    await ctx.reply('Pick a channel for the new tracking link:', { reply_markup: keyboard });
  });

  bot.callbackQuery(/^nl:(.+)$/, async (ctx) => {
    const channelId = ctx.match[1];

    // Re-verify access: the button could be stale or forwarded.
    const channels = await getUserActiveChannels(ctx.from.id);
    const channel = channels.find((c) => c.id === channelId);
    if (!channel || channel.botStatus !== BotStatus.ACTIVE) {
      await ctx.answerCallbackQuery({ text: 'This channel is not available anymore.' });
      return;
    }

    setState(ctx.from.id, { step: 'awaiting_label', channelId: channel.id });
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      [
        `Channel: ${channel.title}`,
        '',
        'Send a label for this link (e.g. "seeding @channel, June 20")',
      ].join('\n'),
    );
  });

  bot.on('message:text', async (ctx, next) => {
    if (ctx.chat.type !== 'private' || ctx.message.text.startsWith('/')) return next();

    const state = getState(ctx.from.id);
    if (!state || state.step !== 'awaiting_label') return next();

    const label = ctx.message.text.trim();
    if (!label) {
      await ctx.reply('Label cannot be empty. Send a short name for this link.');
      return;
    }

    const channel = await prisma.channel.findUnique({ where: { id: state.channelId } });
    if (!channel || channel.botStatus !== BotStatus.ACTIVE) {
      clearState(ctx.from.id);
      await ctx.reply('That channel is no longer available. Start over with /newlink.');
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
      await ctx.reply(
        `Failed to create invite link: ${description}. Check that the bot is still an admin in "${channel.title}".`,
      );
      return;
    }

    const trackedLink = await createTrackedLink(channel.id, label, inviteLink);
    clearState(ctx.from.id);

    if (!trackedLink) {
      await ctx.reply('Failed to save the link. Please try /newlink again.');
      return;
    }

    const goUrl = `${config.goBaseUrl}/l/${trackedLink.slug}`;
    await ctx.reply(
      [
        `Link created for <b>${escapeHtml(channel.title)}</b>`,
        '',
        `Label: ${escapeHtml(label)}`,
        `Tracking URL: <code>${escapeHtml(goUrl)}</code>`,
        `Invite link: <code>${escapeHtml(inviteLink)}</code>`,
        '',
        'Share the tracking URL in your ads and posts. Clicks and joins through it are attributed to this label. See results with /stats.',
      ].join('\n'),
      { parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
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
