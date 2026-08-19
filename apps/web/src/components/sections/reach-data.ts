/**
 * Markets and ad platforms for the Global reach section.
 *
 * Platform statuses are derived from AD_PROVIDERS rather than written out, so the
 * landing page cannot claim a live integration the product does not have yet.
 * Coordinates are in the map viewBox from reach-geometry.ts.
 */

import { AD_PROVIDERS, type AdProvider } from '@/lib/ad-providers';
import { type CellFilter, toCell } from './reach-geometry';

/* ----------------------------------------------------------------- markets */

export type MarketTier = 'A' | 'B';

export interface Market {
  name: string;
  x: number;
  y: number;
  tier: MarketTier;
  /** Label offset from the marker, hand placed so labels never collide. */
  dx: number;
  dy: number;
  anchor: 'start' | 'middle' | 'end';
  /** What buyers here actually run. Revealed on hover and keyboard focus. */
  buys: string;
  /** Additional unlabelled dots that belong to the same market. */
  satellites?: readonly { x: number; y: number }[];
}

export const MARKETS: readonly Market[] = [
  {
    name: 'India',
    x: 552,
    y: 148,
    tier: 'A',
    dx: 12,
    dy: 6,
    anchor: 'start',
    buys: 'Meta, Google',
  },
  {
    name: 'Russia & CIS',
    x: 464,
    y: 79,
    tier: 'A',
    dx: 12,
    dy: 4,
    anchor: 'start',
    buys: 'Yandex, seeding',
  },
  {
    name: 'Brazil & LATAM',
    x: 279,
    y: 218,
    tier: 'A',
    dx: 12,
    dy: 4,
    anchor: 'start',
    buys: 'Meta, TikTok',
  },
  {
    name: 'Indonesia',
    x: 611,
    y: 206,
    tier: 'B',
    dx: 12,
    dy: 4,
    anchor: 'start',
    buys: 'Meta, TikTok',
  },
  {
    name: 'United States',
    x: 180,
    y: 114,
    tier: 'B',
    dx: -12,
    dy: 4,
    anchor: 'end',
    buys: 'Meta, Google',
  },
  {
    name: 'Germany & Italy',
    x: 413,
    y: 86,
    tier: 'B',
    dx: 0,
    dy: -13,
    anchor: 'middle',
    buys: 'Meta, Google',
    satellites: [{ x: 411, y: 108 }],
  },
  {
    name: 'MENA & Egypt',
    x: 451,
    y: 132,
    tier: 'B',
    dx: -12,
    dy: 11,
    anchor: 'end',
    buys: 'Meta, TikTok, Snap',
    satellites: [{ x: 484, y: 143 }],
  },
  {
    name: 'Iran',
    x: 494,
    y: 120,
    tier: 'B',
    dx: 12,
    dy: 4,
    anchor: 'start',
    buys: 'Seeding only',
  },
];

/** Every marker dot, primaries and satellites, as grid cells. */
const HOT_CELLS = MARKETS.flatMap((m) =>
  [{ x: m.x, y: m.y }, ...(m.satellites ?? [])].map((p) => toCell(p.x, p.y)),
);

const HOT_RADIUS_CELLS = 3;

/** Land within three cells of a market, drawn brighter on top of the base field. */
export const isHotCell: CellFilter = (col, row) =>
  HOT_CELLS.some(({ col: hc, row: hr }) => {
    const dc = col - hc;
    const dr = row - hr;
    return dc * dc + dr * dr <= HOT_RADIUS_CELLS * HOT_RADIUS_CELLS;
  });

/** Hover tag box, sized from the character count of a monospace label. */
const TAG = { charW: 5.4, padX: 7, height: 15 } as const;

export function tagBox(market: Market) {
  const w = market.buys.length * TAG.charW + TAG.padX * 2;
  const anchorX = market.x + market.dx;
  const x =
    market.anchor === 'end' ? anchorX - w : market.anchor === 'middle' ? anchorX - w / 2 : anchorX;
  const labelY = market.y + market.dy;
  const y = market.dy < 0 ? labelY - 11 - TAG.height : labelY + 6;

  return {
    x,
    y,
    w,
    h: TAG.height,
    textX: x + TAG.padX,
    textY: y + TAG.height / 2,
  };
}

/* --------------------------------------------------------------- platforms */

/** Drives the rail colour, the legend bucket and whether a strand is drawn at all. */
export type PlatformKind = 'live' | 'building' | 'postback' | 'none';

interface PlatformCopy {
  status: string;
  note: string;
}

interface PlatformSpec {
  id: string;
  name: string;
  /** Set when a real integration backs this row; its state comes from AD_PROVIDERS. */
  provider?: AdProvider;
  /** Kind used once the integration is connectable. */
  kind: Exclude<PlatformKind, 'building'>;
  live: PlatformCopy;
  /** Shown while AD_PROVIDERS still marks the provider as coming soon. */
  pending?: PlatformCopy;
}

const PLATFORM_SPECS: readonly PlatformSpec[] = [
  {
    id: 'meta',
    name: 'Meta',
    provider: 'META_CAPI',
    kind: 'live',
    live: {
      status: 'Conversions API',
      note: 'Every subscribe uploads against the original fbclid.',
    },
    pending: {
      status: 'Building',
      note: 'Server side events by fbclid. Access review pending.',
    },
  },
  {
    id: 'yandex',
    name: 'Yandex Metrica',
    provider: 'YANDEX_METRIKA',
    kind: 'live',
    live: {
      status: 'Offline conversions',
      note: 'Uploads by yclid, Direct optimizes on your goal.',
    },
    pending: {
      status: 'Building',
      note: 'Offline conversions by yclid. Counter access pending.',
    },
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    provider: 'TIKTOK_EVENTS',
    kind: 'live',
    live: {
      status: 'Events API 2.0',
      note: 'Same shape as Meta, keyed on ttclid.',
    },
    pending: {
      status: 'Building',
      note: 'Events API 2.0 by ttclid. Pixel access pending.',
    },
  },
  {
    id: 'google',
    name: 'Google Ads',
    provider: 'GOOGLE_ADS',
    kind: 'live',
    live: {
      status: 'Click conversions',
      note: 'Offline click conversions by gclid.',
    },
    pending: {
      status: 'Building',
      note: 'Offline click conversions by gclid. Developer token pending.',
    },
  },
  {
    id: 'push',
    name: 'Push and pop networks',
    kind: 'postback',
    live: {
      status: 'Generic S2S',
      note: 'RichAds, PropellerAds and similar. Already covered by postbacks.',
    },
  },
  {
    id: 'tgads',
    name: 'Telegram Ads',
    kind: 'none',
    live: {
      status: 'No conversion API',
      note: 'It does not exist. Our reports tell you which creative to pause.',
    },
  },
  {
    id: 'seeding',
    name: 'Channel seeding',
    kind: 'none',
    live: {
      status: 'No platform to feed',
      note: 'You get fraud detection and buyer comparison instead.',
    },
  },
];

export interface PlatformRow extends PlatformCopy {
  id: string;
  name: string;
  kind: PlatformKind;
  /** False for platforms with nothing to send to: they get a stub, not a line. */
  hasStrand: boolean;
}

function resolvePlatform(spec: PlatformSpec): PlatformRow {
  const pending = spec.provider ? AD_PROVIDERS[spec.provider].comingSoon : false;
  const copy = pending && spec.pending ? spec.pending : spec.live;
  const kind: PlatformKind = pending ? 'building' : spec.kind;

  return {
    id: spec.id,
    name: spec.name,
    kind,
    hasStrand: kind !== 'none',
    ...copy,
  };
}

export const PLATFORMS: readonly PlatformRow[] = PLATFORM_SPECS.map(resolvePlatform);

export const LEGEND: readonly { key: PlatformKind; label: string }[] = [
  { key: 'live', label: 'Live' },
  { key: 'building', label: 'Building' },
  { key: 'postback', label: 'Postback only' },
  { key: 'none', label: 'No API' },
];
