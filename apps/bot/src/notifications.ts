import { GrammyError, type Api } from 'grammy';
import { EventType, type Channel } from '@tgpulse/db';
import { texts } from './texts';

// TODO(phase-2): persist notification subscriptions in the DB (schema is frozen for Phase 1).
// In-memory map: channelId -> set of Telegram user ids who opted in. Default is off.
const subscriptions = new Map<string, Set<number>>();

const TG_FORBIDDEN = 403; // user blocked the bot or never started it

export function isSubscribed(channelId: string, tgUserId: number): boolean {
  return subscriptions.get(channelId)?.has(tgUserId) ?? false;
}

export function hasSubscribers(channelId: string): boolean {
  return (subscriptions.get(channelId)?.size ?? 0) > 0;
}

/** Toggle a user's subscription for a channel. Returns the new state (true = on). */
export function toggleSubscription(channelId: string, tgUserId: number): boolean {
  const current = subscriptions.get(channelId) ?? new Set<number>();
  const isOn = current.has(tgUserId);
  const updated = new Set(current);
  if (isOn) {
    updated.delete(tgUserId);
  } else {
    updated.add(tgUserId);
  }
  subscriptions.set(channelId, updated);
  return !isOn;
}

/** Fan out an instant join/leave alert to opted-in users. Never throws. */
export async function notifyMemberEvent(
  api: Api,
  channel: Channel,
  type: EventType,
  sourceLabel: string,
): Promise<void> {
  const recipients = subscriptions.get(channel.id);
  if (!recipients || recipients.size === 0) return;

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
