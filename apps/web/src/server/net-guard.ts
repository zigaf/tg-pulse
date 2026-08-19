import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
// undici's own fetch is required: the global fetch ignores a dispatcher created here.
import { Agent, fetch as undiciFetch } from 'undici';

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

const MAX_REDIRECTS = 3;

/**
 * Fetch a user-supplied URL with the guard re-applied on every redirect hop.
 * `redirect: 'follow'` would let a public host bounce us into the private network.
 */
export async function safeFetch(
  rawUrl: string,
  timeoutMs: number,
): Promise<{ status: number; headers: { get(name: string): string | null } }> {
  let url = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const validatedIp = await resolvePublicAddress(url);
    const agent = pinnedAgent(validatedIp);
    try {
      const res = await undiciFetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        // Pin the connection to the address the guard just approved: plain DNS
        // would be resolved again here, and a low-TTL record can rebind to a private IP.
        dispatcher: agent,
      });

      if (res.status < 300 || res.status >= 400) return res;

      const location = res.headers.get('location');
      if (!location) return res;
      url = new URL(location, url).toString();
    } finally {
      void agent.close();
    }
  }

  throw new Error('too many redirects');
}

/**
 * Dispatcher that always connects to the address the guard approved.
 * undici calls lookup with `all: true`, so the answer must be an array.
 */
function pinnedAgent(ip: { address: string; family: number }): Agent {
  return new Agent({
    connect: {
      lookup: (_hostname: string, options: { all?: boolean }, callback: Function) => {
        if (options?.all) {
          callback(null, [{ address: ip.address, family: ip.family }]);
          return;
        }
        callback(null, ip.address, ip.family);
      },
    },
  } as ConstructorParameters<typeof Agent>[0]);
}

/**
 * Validate the URL and return the address the request must connect to.
 * Literal IPs are used as is; hostnames are resolved once and that answer is pinned.
 */
async function resolvePublicAddress(rawUrl: string): Promise<{ address: string; family: number }> {
  await assertPublicHttpUrl(rawUrl);
  const host = new URL(rawUrl).hostname;
  if (isIP(host)) {
    return { address: host, family: isIP(host) };
  }
  const resolved = await lookup(host, { all: true });
  const usable = resolved.find((r) => !isPrivateIp(r.address));
  if (!usable) throw new Error('host resolves to a private address');
  return { address: usable.address, family: usable.family };
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
