import { GrammyError, type Api } from 'grammy';
import { getPrisma, EventType, type Channel } from '@tgpulse/db';
import { escapeHtml } from './format';
import { DEFAULT_LANG, getDict, type Lang } from './i18n';
import { getLangsByTgId } from './i18n/user-lang';

const prisma = getPrisma();

const TG_FORBIDDEN = 403; // user blocked the bot or never started it

/**
 * channelId -> opted-in Telegram user id and the locale to write to them in.
 *
 * AlertSubscription in Postgres is the source of truth; this map only keeps the
 * join/leave fan-out from querying the DB on every single member event. It starts
 * empty on boot, fills lazily on first use, and the affected channel entry is
 * dropped on every toggle so the next event reloads it.
 */
const subscribersByChannel = new Map<string, Map<number, Lang>>();

async function loadSubscribers(channelId: string): Promise<Map<number, Lang>> {
  const cached = subscribersByChannel.get(channelId);
  if (cached) return cached;

  const rows = await prisma.alertSubscription.findMany({
    where: { channelId },
    select: { tgUserId: true },
  });
  const ids = rows.map((row) => Number(row.tgUserId));

  // Locales are resolved together with the recipients so an alert never costs a query.
  const langs = await getLangsByTgId(ids);
  const loaded = new Map(ids.map((id) => [id, langs.get(id) ?? DEFAULT_LANG]));
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

/**
 * Fan out an instant join/leave alert to opted-in users, each in their own language.
 * `sourceLabel` is null for organic traffic, which is named by the dictionary.
 * Never throws.
 */
export async function notifyMemberEvent(
  api: Api,
  channel: Channel,
  type: EventType,
  sourceLabel: string | null,
): Promise<void> {
  const recipients = await loadSubscribers(channel.id);
  if (recipients.size === 0) return;

  const title = escapeHtml(channel.title);

  for (const [tgUserId, lang] of recipients) {
    const dict = getDict(lang);
    const source = sourceLabel === null ? dict.sources.organic : escapeHtml(sourceLabel);
    const text =
      type === EventType.JOIN ? dict.alerts.joined(title, source) : dict.alerts.left(title, source);

    try {
      await api.sendMessage(tgUserId, text, { parse_mode: 'HTML' });
    } catch (error) {
      if (error instanceof GrammyError && error.error_code === TG_FORBIDDEN) continue;
      console.error(`Instant notification: failed to message user ${tgUserId}`, error);
    }
  }
}
