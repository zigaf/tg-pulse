import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * SSRF guard for user-supplied postback URLs: allow only public http(s) hosts.
 * Mirrored in apps/web/src/server/net-guard.ts (keep both in sync).
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

const MAX_REDIRECTS = 3;

/**
 * Fetch a user-supplied URL with the guard re-applied on every redirect hop.
 * `redirect: 'follow'` would let a public host bounce us into the private network.
 */
export async function safeFetch(rawUrl: string, timeoutMs: number): Promise<Response> {
  let url = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublicHttpUrl(url);
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.status < 300 || res.status >= 400) return res;

    const location = res.headers.get('location');
    if (!location) return res;
    url = new URL(location, url).toString();
  }

  throw new Error('too many redirects');
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
