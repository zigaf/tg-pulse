/** In-memory dialog state for multi-step bot conversations (MVP; single process). */

const STATE_TTL_MS = 10 * 60 * 1000; // a dialog step expires after 10 minutes
const SWEEP_INTERVAL_MS = 60 * 1000;

export interface NewlinkState {
  step: 'awaiting_label';
  channelId: string;
}

interface StoredState extends NewlinkState {
  expiresAt: number;
}

const states = new Map<number, StoredState>();

export function setState(tgUserId: number, state: NewlinkState): void {
  states.set(tgUserId, { ...state, expiresAt: Date.now() + STATE_TTL_MS });
}

export function getState(tgUserId: number): NewlinkState | undefined {
  const stored = states.get(tgUserId);
  if (!stored) return undefined;
  if (stored.expiresAt <= Date.now()) {
    states.delete(tgUserId);
    return undefined;
  }
  const { expiresAt: _expiresAt, ...state } = stored;
  return state;
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
