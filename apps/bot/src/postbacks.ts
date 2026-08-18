import { getPrisma, Prisma } from '@tgpulse/db';
import { assertPublicHttpUrl } from './net-guard';

const prisma = getPrisma();

const CLICK_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;
const RETRY_DELAY_MS = 30_000;

type PostbackEvent = 'join' | 'leave';

interface LinkRef {
  id: string;
  slug: string;
  label: string;
}

interface AdClickIds {
  yclid?: string;
  gclid?: string;
  fbclid?: string;
  ttclid?: string;
}

/** Supported {macro} names -> resolved values. Missing values render as ''. */
type MacroValues = Record<
  'event' | 'slug' | 'label' | 'cid' | 'yclid' | 'gclid' | 'fbclid' | 'ttclid' | 'tg_user_id',
  string
>;

function renderTemplate(template: string, values: MacroValues): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? encodeURIComponent(values[key as keyof MacroValues]) : match,
  );
}

/** Latest attributed click of the link (pixel cid / ad click ids) within the lookback window. */
async function findAttributionClick(linkId: string) {
  return prisma.click.findFirst({
    where: {
      linkId,
      ts: { gte: new Date(Date.now() - CLICK_LOOKBACK_MS) },
      OR: [{ clientId: { not: null } }, { adClickIds: { not: Prisma.AnyNull } }],
    },
    orderBy: { ts: 'desc' },
  });
}

async function sendPostback(name: string, url: string, allowRetry: boolean): Promise<void> {
  try {
    await assertPublicHttpUrl(url); // SSRF guard: user-supplied URL
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    console.log(`[postback] ${name} ${res.status} ${url}`);
    if (res.status >= 500 && allowRetry) {
      scheduleRetry(name, url);
    }
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.log(`[postback] ${name} FAIL (${reason}) ${url}`);
    if (allowRetry) {
      scheduleRetry(name, url);
    }
  }
}

function scheduleRetry(name: string, url: string): void {
  console.log(`[postback] ${name} retry in ${RETRY_DELAY_MS / 1000}s`);
  const timer = setTimeout(() => {
    void sendPostback(name, url, false);
  }, RETRY_DELAY_MS);
  // Fire-and-forget: an in-flight retry must not keep the process alive
  timer.unref();
}

/**
 * Fire all matching active postbacks of the channel for a join/leave event.
 * Never throws — designed to be called as `void firePostbacks(...)` from the
 * chat_member handler without blocking attribution processing.
 */
export async function firePostbacks(
  channel: { id: string },
  event: PostbackEvent,
  link: LinkRef | null,
  subscriberTgId: bigint,
): Promise<void> {
  try {
    const postbacks = await prisma.postback.findMany({
      where: {
        channelId: channel.id,
        isActive: true,
        ...(event === 'join' ? { onJoin: true } : { onLeave: true }),
      },
    });
    if (postbacks.length === 0) return;

    // Attributed joins/leaves: the latest pixel-enriched click is the macro source
    const click = link ? await findAttributionClick(link.id) : null;
    const adClickIds: AdClickIds = (click?.adClickIds as AdClickIds | null) ?? {};

    const values: MacroValues = {
      event,
      slug: link?.slug ?? '',
      label: link?.label ?? '',
      cid: click?.clientId ?? '',
      yclid: adClickIds.yclid ?? '',
      gclid: adClickIds.gclid ?? '',
      fbclid: adClickIds.fbclid ?? '',
      ttclid: adClickIds.ttclid ?? '',
      tg_user_id: subscriberTgId.toString(),
    };

    for (const postback of postbacks) {
      const url = renderTemplate(postback.urlTemplate, values);
      void sendPostback(postback.name, url, true);
    }
  } catch (e) {
    console.log(`[postback] dispatch failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}
