import type { FastifyInstance, FastifyReply } from 'fastify';
import { getPrisma, PixelEventType } from '@tgpulse/db';
import { PIXEL_SCRIPT } from './pixel-script';

const prisma = getPrisma();

const MAX_FIELD_LENGTH = 500;
const AD_CLICK_ID_KEYS = ['yclid', 'gclid', 'fbclid', 'ttclid'] as const;
const SCRIPT_CACHE_SECONDS = 3600;

interface PixelPayload {
  slug: string;
  cid: string;
  type: PixelEventType;
  url?: string;
  ref?: string;
  utm: { source?: string; medium?: string; campaign?: string };
  ids: Record<string, string>;
}

function withCors(reply: FastifyReply): FastifyReply {
  return reply
    .header('access-control-allow-origin', '*')
    .header('access-control-allow-methods', 'POST, OPTIONS')
    .header('access-control-allow-headers', 'content-type');
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return value.slice(0, MAX_FIELD_LENGTH);
}

/** Manual body validation: beacons arrive as text/plain JSON, so no schema layer. */
function parsePixelPayload(rawBody: unknown): PixelPayload | null {
  let body: unknown = rawBody;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return null;
    }
  }
  if (typeof body !== 'object' || body === null) return null;

  const b = body as Record<string, unknown>;
  const slug = asTrimmedString(b.k);
  const cid = asTrimmedString(b.cid);
  if (!slug || !cid) return null;
  if (b.t !== 'pv' && b.t !== 'click') return null;

  const rawUtm = typeof b.utm === 'object' && b.utm !== null ? (b.utm as Record<string, unknown>) : {};
  const rawIds = typeof b.ids === 'object' && b.ids !== null ? (b.ids as Record<string, unknown>) : {};

  const ids: Record<string, string> = {};
  for (const key of AD_CLICK_ID_KEYS) {
    const value = asTrimmedString(rawIds[key]);
    if (value) ids[key] = value;
  }

  return {
    slug,
    cid,
    type: b.t === 'pv' ? PixelEventType.PAGEVIEW : PixelEventType.CLICK,
    url: asTrimmedString(b.url),
    ref: asTrimmedString(b.ref),
    utm: {
      source: asTrimmedString(rawUtm.source),
      medium: asTrimmedString(rawUtm.medium),
      campaign: asTrimmedString(rawUtm.campaign),
    },
    ids,
  };
}

async function recordPixelEvent(payload: PixelPayload): Promise<void> {
  const link = await prisma.trackedLink.findUnique({ where: { slug: payload.slug } });
  if (!link || link.isRevoked) return;

  await prisma.pixelEvent.create({
    data: {
      linkId: link.id,
      clientId: payload.cid,
      type: payload.type,
      url: payload.url,
      referer: payload.ref,
      utmSource: payload.utm.source,
      utmMedium: payload.utm.medium,
      utmCampaign: payload.utm.campaign,
      ...(Object.keys(payload.ids).length > 0 ? { adClickIds: payload.ids } : {}),
    },
  });
}

/** Pixel engine: serves the landing-page script and ingests its beacons. */
export function registerPixel(app: FastifyInstance): void {
  // navigator.sendBeacon(string) posts as text/plain, accept it as a raw string
  app.addContentTypeParser('text/plain', { parseAs: 'string' }, (_req, body, done) => {
    done(null, body);
  });

  app.get('/pixel.js', async (_req, reply) => {
    return reply
      .header('content-type', 'application/javascript; charset=utf-8')
      .header('cache-control', `public, max-age=${SCRIPT_CACHE_SECONDS}`)
      .header('access-control-allow-origin', '*')
      .send(PIXEL_SCRIPT);
  });

  app.options('/px', async (_req, reply) => {
    return withCors(reply).code(204).send();
  });

  // Public ingest: throttled per IP so the events table cannot be flooded
  app.post('/px', { config: { rateLimit: { max: 240, timeWindow: '1 minute' } } }, async (req, reply) => {
    const payload = parsePixelPayload(req.body);

    // Fire-and-forget: never make the landing page wait for a stats write
    if (payload) {
      recordPixelEvent(payload).catch((e: unknown) =>
        app.log.error(e, 'pixel event write failed'),
      );
    }
    return withCors(reply).code(204).send();
  });
}
