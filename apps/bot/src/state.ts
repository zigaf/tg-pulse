/** In-memory dialog state for multi-step bot conversations (MVP; single process). */

const STATE_TTL_MS = 10 * 60 * 1000; // a dialog step expires after 10 minutes
const SWEEP_INTERVAL_MS = 60 * 1000;

/**
 * One user is in at most one dialog at a time, so /newlink and /bulklinks share this map.
 * The step tells the text handlers whose message this is; everything collected so far
 * travels with it, because nothing is written before the final step.
 */
export type DialogState =
  | { step: 'awaiting_label'; channelId: string }
  | { step: 'awaiting_mode'; channelId: string; label: string }
  | { step: 'awaiting_post_url'; channelId: string; label: string }
  | { step: 'awaiting_buyer'; channelId: string; label: string; targetPostUrl: string | null }
  | { step: 'awaiting_bulk_names'; channelId: string };

interface StoredState {
  state: DialogState;
  expiresAt: number;
}

const states = new Map<number, StoredState>();

export function setState(tgUserId: number, state: DialogState): void {
  states.set(tgUserId, { state, expiresAt: Date.now() + STATE_TTL_MS });
}

export function getState(tgUserId: number): DialogState | undefined {
  const stored = states.get(tgUserId);
  if (!stored) return undefined;
  if (stored.expiresAt <= Date.now()) {
    states.delete(tgUserId);
    return undefined;
  }
  return stored.state;
}

export function clearState(tgUserId: number): void {
  states.delete(tgUserId);
}

// Periodic sweep so abandoned dialogs don't accumulate; unref keeps it from blocking shutdown.
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of states) {
    if (value.expiresAt <= now) states.delete(key);
  }
}, SWEEP_INTERVAL_MS).unref();
