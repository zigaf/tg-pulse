import type { Bot } from 'grammy';
import type { Message, ReactionCount } from 'grammy/types';
import { getPrisma, PostKind, Prisma } from '@tgpulse/db';
import type { BotContext } from './context';

/**
 * Content tracking for connected channels (docs/CONTENT.md).
 *
 * The Bot API delivers three things an admin bot may know about a post:
 * the post itself (`channel_post`), its edits (`edited_channel_post`) and
 * anonymous reaction counts (`message_reaction_count`, explicitly requested
 * in allowed_updates). View counts are MTProto-only — nothing here pretends
 * otherwise. Handlers never throw: content tracking must not break the bot.
 */

const prisma = getPrisma();

const PREVIEW_LENGTH = 160;
/** Label used for custom-emoji reactions, which have no renderable character. */
const CUSTOM_REACTION_LABEL = 'custom';
/** Label for Telegram Stars paid reactions. */
const PAID_REACTION_LABEL = '⭐ paid';

function postKind(message: Message): PostKind {
  if (message.photo) return PostKind.PHOTO;
  if (message.video) return PostKind.VIDEO;
  if (message.animation) return PostKind.ANIMATION;
  if (message.document) return PostKind.DOCUMENT;
  if (message.audio) return PostKind.AUDIO;
  if (message.voice) return PostKind.VOICE;
  if (message.sticker) return PostKind.STICKER;
  if (message.poll) return PostKind.POLL;
  if (message.text !== undefined) return PostKind.TEXT;
  return PostKind.OTHER;
}

function postPreview(message: Message): string {
  const text = message.text ?? message.caption ?? message.poll?.question ?? '';
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length > PREVIEW_LENGTH ? `${collapsed.slice(0, PREVIEW_LENGTH - 1)}…` : collapsed;
}

/** Flatten Bot API reaction counts into `[{ reaction, count }]` rows. */
export function toReactionRows(counts: ReactionCount[]): { reaction: string; count: number }[] {
  return counts
    .map((entry) => ({
      reaction:
        entry.type.type === 'emoji'
          ? entry.type.emoji
          : entry.type.type === 'paid'
            ? PAID_REACTION_LABEL
            : CUSTOM_REACTION_LABEL,
      count: entry.total_count,
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
}

async function findChannelId(tgChatId: number): Promise<string | null> {
  const channel = await prisma.channel.findUnique({
    where: { tgChatId: BigInt(tgChatId) },
    select: { id: true },
  });
  return channel?.id ?? null;
}

function logError(scope: string, e: unknown): void {
  console.error(`[posts] ${scope} failed: ${e instanceof Error ? e.message : String(e)}`);
}

export function registerPostTracking(bot: Bot<BotContext>): void {
  bot.on('channel_post', async (ctx) => {
    try {
      const post = ctx.channelPost;
      const channelId = await findChannelId(post.chat.id);
      if (!channelId) return;

      // Upsert: long-polling restarts can replay an update.
      await prisma.channelPost.upsert({
        where: { channelId_messageId: { channelId, messageId: post.message_id } },
        update: {},
        create: {
          channelId,
          messageId: post.message_id,
          postedAt: new Date(post.date * 1000),
          kind: postKind(post),
          preview: postPreview(post),
        },
      });
    } catch (e) {
      logError('channel_post', e);
    }
  });

  bot.on('edited_channel_post', async (ctx) => {
    try {
      const post = ctx.editedChannelPost;
      const channelId = await findChannelId(post.chat.id);
      if (!channelId) return;

      // Edits of posts published before the channel was connected reference
      // rows we never had; those are skipped rather than half-created.
      await prisma.channelPost.updateMany({
        where: { channelId, messageId: post.message_id },
        data: {
          kind: postKind(post),
          preview: postPreview(post),
          editedAt: post.edit_date ? new Date(post.edit_date * 1000) : new Date(),
        },
      });
    } catch (e) {
      logError('edited_channel_post', e);
    }
  });

  bot.on('message_reaction_count', async (ctx) => {
    try {
      const update = ctx.messageReactionCount;
      if (update.chat.type !== 'channel') return;
      const channelId = await findChannelId(update.chat.id);
      if (!channelId) return;

      const rows = toReactionRows(update.reactions);
      const total = rows.reduce((sum, row) => sum + row.count, 0);

      // Reactions to pre-connect posts reference rows we never had; skip them.
      await prisma.channelPost.updateMany({
        where: { channelId, messageId: update.message_id },
        data: { reactions: rows as unknown as Prisma.InputJsonValue, reactionsTotal: total },
      });
    } catch (e) {
      logError('message_reaction_count', e);
    }
  });
}
