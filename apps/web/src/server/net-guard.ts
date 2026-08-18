import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * SSRF guard for user-supplied postback URLs: allow only public http(s) hosts.
 * Mirrored in apps/bot/src/net-guard.ts (keep both in sync).
 */

const BLOCKED_HOSTNAME = /^(localhost|.*\.local|.*\.internal|.*\.railway\.internal)$/i;

function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    const lower = ip.toLowerCase();
    return (
      lower === '::1' ||
      lower === '::' ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('fe80') ||
      lower.startsWith('::ffff:127.') ||
      lower.startsWith('::ffff:10.') ||
      lower.startsWith('::ffff:192.168.')
    );
  }
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/** Throws if the URL must not be fetched server-side. */
export async function assertPublicHttpUrl(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('only http(s) URLs are allowed');
  }
  const host = url.hostname;
  if (BLOCKED_HOSTNAME.test(host)) {
    throw new Error('host is not allowed');
  }
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new Error('private IP is not allowed');
    return;
  }
  const resolved = await lookup(host, { all: true }).catch(() => {
    throw new Error('host does not resolve');
  });
  if (resolved.some((r) => isPrivateIp(r.address))) {
    throw new Error('host resolves to a private address');
  }
}
