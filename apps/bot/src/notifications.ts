import { GrammyError, type Api } from 'grammy';
import { getPrisma, EventType, type Channel } from '@tgpulse/db';
import { texts } from './texts';

const prisma = getPrisma();

const TG_FORBIDDEN = 403; // user blocked the bot or never started it

/**
 * channelId -> opted-in Telegram user ids.
 *
 * AlertSubscription in Postgres is the source of truth; this map only keeps the
 * join/leave fan-out from querying the DB on every single member event. It starts
 * empty on boot, fills lazily on first use, and the affected channel entry is
 * dropped on every toggle so the next event reloads it.
 */
const subscribersByChannel = new Map<string, Set<number>>();

async function loadSubscribers(channelId: string): Promise<Set<number>> {
  const cached = subscribersByChannel.get(channelId);
  if (cached) return cached;

  const rows = await prisma.alertSubscription.findMany({
    where: { channelId },
    select: { tgUserId: true },
  });
  const loaded = new Set(rows.map((row) => Number(row.tgUserId)));
  subscribersByChannel.set(channelId, loaded);
  return loaded;
}

/** Which of the given channels the user currently gets instant alerts for. */
export async function getSubscribedChannelIds(
  tgUserId: number,
  channelIds: string[],
): Promise<Set<string>> {
  if (channelIds.length === 0) return new Set();

  const rows = await prisma.alertSubscription.findMany({
    where: { tgUserId: BigInt(tgUserId), channelId: { in: channelIds } },
    select: { channelId: true },
  });
  return new Set(rows.map((row) => row.channelId));
}

/** Cheap guard before doing the work of building an alert. Served from the cache. */
export async function hasSubscribers(channelId: string): Promise<boolean> {
  return (await loadSubscribers(channelId)).size > 0;
}

/** Toggle a user's subscription for a channel. Returns the new state (true = on). */
export async function toggleSubscription(channelId: string, tgUserId: number): Promise<boolean> {
  const key = { channelId, tgUserId: BigInt(tgUserId) };
  const existing = await prisma.alertSubscription.findUnique({
    where: { channelId_tgUserId: key },
  });

  // deleteMany/upsert instead of delete/create: a double tap must not throw.
  if (existing) {
    await prisma.alertSubscription.deleteMany({ where: key });
  } else {
    await prisma.alertSubscription.upsert({
      where: { channelId_tgUserId: key },
      create: key,
      update: {},
    });
  }

  subscribersByChannel.delete(channelId);
  return existing === null;
}

/** Fan out an instant join/leave alert to opted-in users. Never throws. */
export async function notifyMemberEvent(
  api: Api,
  channel: Channel,
  type: EventType,
  sourceLabel: string,
): Promise<void> {
  const recipients = await loadSubscribers(channel.id);
  if (recipients.size === 0) return;

  const text =
    type === EventType.JOIN
      ? texts.notifications.joined(channel.title, sourceLabel)
      : texts.notifications.left(channel.title, sourceLabel);

  for (const tgUserId of recipients) {
    try {
      await api.sendMessage(tgUserId, text, { parse_mode: 'HTML' });
    } catch (error) {
      if (error instanceof GrammyError && error.error_code === TG_FORBIDDEN) continue;
      console.error(`Instant notification: failed to message user ${tgUserId}`, error);
    }
  }
}
