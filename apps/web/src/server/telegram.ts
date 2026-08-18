import { requireEnv } from './env';

/** Telegram limits invite link names to 32 characters. */
const INVITE_LINK_NAME_MAX = 32;

/** Error raised when Telegram Bot API rejects a call; `description` comes from TG. */
export class TelegramApiError extends Error {
  constructor(
    public readonly description: string,
    public readonly code?: number,
  ) {
    super(description);
    this.name = 'TelegramApiError';
  }
}

interface TgResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

interface ChatInviteLink {
  invite_link: string;
  name?: string;
  is_revoked: boolean;
}

async function callBotApi<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  const token = requireEnv('BOT_TOKEN');
  let res: Response;
  try {
    res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new TelegramApiError(`Telegram API unreachable (${method})`);
  }

  const body = (await res.json().catch(() => null)) as TgResponse<T> | null;
  if (!body || body.ok !== true || body.result === undefined) {
    throw new TelegramApiError(
      body?.description ?? `${method} failed with HTTP ${res.status}`,
      body?.error_code,
    );
  }
  return body.result;
}

/** Create a unique invite link for the channel; returns the `t.me/+...` URL. */
export async function createChatInviteLink(tgChatId: bigint, name: string): Promise<string> {
  const result = await callBotApi<ChatInviteLink>('createChatInviteLink', {
    chat_id: tgChatId.toString(),
    name: name.slice(0, INVITE_LINK_NAME_MAX),
    creates_join_request: false,
  });
  return result.invite_link;
}

/** Revoke a previously created invite link. */
export async function revokeChatInviteLink(tgChatId: bigint, inviteLink: string): Promise<void> {
  await callBotApi<ChatInviteLink>('revokeChatInviteLink', {
    chat_id: tgChatId.toString(),
    invite_link: inviteLink,
  });
}
