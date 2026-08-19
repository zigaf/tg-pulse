import type { Channel } from '@tgpulse/db';

/**
 * Landing-post mode: the tracking URL redirects to a post instead of an invite link.
 *
 * The target is stored verbatim and later handed to a 302, so an unchecked value would
 * turn every tracking link into an open redirect. A URL is therefore accepted only when
 * it is a t.me post URL AND provably points at the channel the link belongs to:
 * by username for public channels, by internal chat id for private ones.
 */

const TELEGRAM_HOST = 't.me';
/** Private channels are addressed as t.me/c/<internal id>/<message id>. */
const PRIVATE_SEGMENT = 'c';
/** Bot API channel ids are the internal id prefixed with -100. */
const CHANNEL_ID_PREFIX = '100';

const USERNAME_PATTERN = /^[A-Za-z0-9_]{4,32}$/;
const MESSAGE_ID_PATTERN = /^[1-9]\d*$/;

const PUBLIC_SEGMENTS = 2; // <username>/<message id>
const PRIVATE_SEGMENTS = 3; // c/<internal id>/<message id>

export type PostUrlError =
  /** Not an https t.me address at all. */
  | 'notTelegram'
  /** On t.me, but not shaped like a post. */
  | 'notAPost'
  /** A valid post URL of some other chat. */
  | 'otherChannel'
  /** Public form used for a channel that has no username to check against. */
  | 'noUsername';

export type PostUrlCheck = { ok: true; url: string } | { ok: false; error: PostUrlError };

/** -1001234567890 -> "1234567890": the id Telegram puts in a t.me/c/ URL. */
function internalChatId(tgChatId: bigint): string {
  const digits = (tgChatId < 0n ? -tgChatId : tgChatId).toString();
  return digits.startsWith(CHANNEL_ID_PREFIX) ? digits.slice(CHANNEL_ID_PREFIX.length) : digits;
}

/** Rebuilt from the parsed parts, so query strings and fragments never survive. */
function canonical(segments: string[]): string {
  return `https://${TELEGRAM_HOST}/${segments.join('/')}`;
}

function reject(error: PostUrlError): PostUrlCheck {
  return { ok: false, error };
}

export function validatePostUrl(raw: string, channel: Channel): PostUrlCheck {
  const trimmed = raw.trim();
  // Telegram itself shows post links without a scheme, so pasting one is common.
  // The host is verified below either way, this only helps the URL parser.
  const candidate = trimmed.startsWith(`${TELEGRAM_HOST}/`) ? `https://${trimmed}` : trimmed;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return reject('notTelegram');
  }

  // Userinfo tricks like https://t.me@evil.com/1 already parse to hostname evil.com.
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return reject('notTelegram');
  if (parsed.hostname.toLowerCase() !== TELEGRAM_HOST) return reject('notTelegram');

  const segments = parsed.pathname.split('/').filter((segment) => segment.length > 0);

  if (segments[0] === PRIVATE_SEGMENT) {
    if (segments.length !== PRIVATE_SEGMENTS || !MESSAGE_ID_PATTERN.test(segments[2])) {
      return reject('notAPost');
    }
    if (segments[1] !== internalChatId(channel.tgChatId)) return reject('otherChannel');
    return { ok: true, url: canonical(segments) };
  }

  if (segments.length !== PUBLIC_SEGMENTS || !MESSAGE_ID_PATTERN.test(segments[1])) {
    return reject('notAPost');
  }
  // Strict pattern instead of decoding: percent-encoded look-alikes are simply not usernames.
  if (!USERNAME_PATTERN.test(segments[0])) return reject('notAPost');
  if (!channel.username) return reject('noUsername');
  if (segments[0].toLowerCase() !== channel.username.toLowerCase()) return reject('otherChannel');

  return { ok: true, url: canonical(segments) };
}
