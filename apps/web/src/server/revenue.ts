import { EventType, getPrisma, Prisma, SaleKind } from '@tgpulse/db';
import { ApiError } from './http';
import { DEFAULT_CURRENCY } from './sales';

/**
 * ROMI reporting: joins the attribution graph (clicks -> subscribers) to the
 * revenue graph (sale events) so every tracked source shows what it earned.
 *
 * Currency policy: sale events are aggregated in the channel's *dominant*
 * currency only — the one with the most events in the period. When the period
 * contains more than one currency, `mixedCurrencies: true` tells the UI that
 * rows in other currencies were excluded (summing across currencies without
 * FX rates would be wrong; we have no rate source).
 *
 * Revenue = sum(PURCHASE) - sum(REFUND). LEAD rows carry no money and only
 * feed the `leads` counter.
 */

const DAY_MS = 86_400_000;
const PERCENT_SCALE = 2;
const MONEY_SCALE = 2;

export const REVENUE_PERIODS = [7, 30, 90] as const;
export type RevenuePeriod = (typeof REVENUE_PERIODS)[number];

export function parseRevenueDays(raw: string | null): RevenuePeriod {
  const days = Number(raw ?? '7');
  const match = REVENUE_PERIODS.find((period) => period === days);
  if (!match) {
    throw new ApiError(400, `days must be one of ${REVENUE_PERIODS.join(', ')}`);
  }
  return match;
}

function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Start of the period: UTC midnight, `days - 1` days back (so today is included). */
function periodStart(days: number, now = new Date()): Date {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(midnight - (days - 1) * DAY_MS);
}

/** Decimal -> JSON number, rounded to cents (safe: aggregates stay far below 2^53). */
function toMoney(value: Prisma.Decimal): number {
  return Number(value.toFixed(MONEY_SCALE));
}

/** Percent as a number: 3.2 means 3.2%. */
function toPercent(part: number, total: number): number {
  if (total === 0) return 0;
  return Number(((part / total) * 100).toFixed(PERCENT_SCALE));
}

function divide(value: Prisma.Decimal, divisor: number): number {
  if (divisor === 0) return 0;
  return toMoney(value.dividedBy(divisor));
}

/** Identity used to count distinct buyers; Telegram id wins over username. */
function buyerKey(sale: { tgUserId: bigint | null; username: string | null }): string | null {
  if (sale.tgUserId !== null) return `tg:${sale.tgUserId.toString()}`;
  if (sale.username) return `un:${sale.username.toLowerCase()}`;
  return null;
}

interface SourceAccumulator {
  revenue: Prisma.Decimal;
  purchases: number;
}

export interface RevenueReport {
  totals: {
    revenue: number;
    purchases: number;
    leads: number;
    refunds: number;
    currency: string;
    /** Revenue per distinct paying buyer in the period. */
    arpu: number;
    /** Percent of sale events resolved to a tracked link at ingest time. */
    matchedRate: number;
  };
  /** True when the period contained sale events in more than one currency. */
  mixedCurrencies: boolean;
  sources: {
    linkId: string | null;
    label: string;
    joins: number;
    revenue: number;
    purchases: number;
    /** Revenue per join (no ad spend in the model yet, so this is gross per acquisition). */
    romiPerJoin: number;
    /** Percent of joins that produced at least one purchase event. */
    conversionRate: number;
  }[];
  series: { date: string; revenue: number }[];
}

/** Currency with the most events in the period; ties broken alphabetically for stability. */
function dominantCurrency(sales: readonly { currency: string }[]): string {
  const counts = new Map<string, number>();
  for (const sale of sales) {
    counts.set(sale.currency, (counts.get(sale.currency) ?? 0) + 1);
  }
  let winner = DEFAULT_CURRENCY;
  let best = -1;
  for (const [currency, count] of [...counts].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (count > best) {
      winner = currency;
      best = count;
    }
  }
  return winner;
}

export async function buildRevenueReport(channelId: string, days: number): Promise<RevenueReport> {
  const since = periodStart(days);
  const prisma = getPrisma();

  const [sales, joinGroups, links] = await Promise.all([
    prisma.saleEvent.findMany({
      where: { channelId, occurredAt: { gte: since } },
      select: {
        amount: true,
        currency: true,
        kind: true,
        linkId: true,
        occurredAt: true,
        tgUserId: true,
        username: true,
      },
    }),
    prisma.memberEvent.groupBy({
      by: ['linkId'],
      where: { channelId, type: EventType.JOIN, ts: { gte: since } },
      _count: { _all: true },
    }),
    prisma.trackedLink.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, label: true },
    }),
  ]);

  const currency = dominantCurrency(sales);
  const mixedCurrencies = new Set(sales.map((sale) => sale.currency)).size > 1;
  const inCurrency = sales.filter((sale) => sale.currency === currency);

  const byDay = new Map<string, Prisma.Decimal>();
  for (let i = 0; i < days; i++) {
    byDay.set(utcDayKey(new Date(since.getTime() + i * DAY_MS)), new Prisma.Decimal(0));
  }

  const bySource = new Map<string | null, SourceAccumulator>();
  const buyers = new Set<string>();
  let revenue = new Prisma.Decimal(0);
  let purchases = 0;
  let leads = 0;
  let refunds = 0;
  let attributed = 0;

  for (const sale of inCurrency) {
    // REFUND subtracts, LEAD is revenue-neutral.
    const signed =
      sale.kind === SaleKind.REFUND
        ? sale.amount.negated()
        : sale.kind === SaleKind.PURCHASE
          ? sale.amount
          : new Prisma.Decimal(0);

    revenue = revenue.plus(signed);
    if (sale.kind === SaleKind.PURCHASE) {
      purchases += 1;
      const key = buyerKey(sale);
      if (key) buyers.add(key);
    } else if (sale.kind === SaleKind.LEAD) {
      leads += 1;
    } else {
      refunds += 1;
    }
    if (sale.linkId !== null) attributed += 1;

    const day = byDay.get(utcDayKey(sale.occurredAt));
    if (day) byDay.set(utcDayKey(sale.occurredAt), day.plus(signed));

    let source = bySource.get(sale.linkId);
    if (!source) {
      source = { revenue: new Prisma.Decimal(0), purchases: 0 };
      bySource.set(sale.linkId, source);
    }
    source.revenue = source.revenue.plus(signed);
    if (sale.kind === SaleKind.PURCHASE) source.purchases += 1;
  }

  const joinsByLink = new Map(joinGroups.map((group) => [group.linkId, group._count._all]));
  const emptySource: SourceAccumulator = { revenue: new Prisma.Decimal(0), purchases: 0 };

  const toSourceRow = (linkId: string | null, label: string) => {
    const stats = bySource.get(linkId) ?? emptySource;
    const joins = joinsByLink.get(linkId) ?? 0;
    return {
      linkId,
      label,
      joins,
      revenue: toMoney(stats.revenue),
      purchases: stats.purchases,
      romiPerJoin: divide(stats.revenue, joins),
      conversionRate: toPercent(stats.purchases, joins),
    };
  };

  const sources = [
    ...links.map((link) => toSourceRow(link.id, link.label)),
    toSourceRow(null, 'Organic'),
  ].sort((a, b) => b.revenue - a.revenue || b.joins - a.joins);

  return {
    totals: {
      revenue: toMoney(revenue),
      purchases,
      leads,
      refunds,
      currency,
      arpu: divide(revenue, buyers.size),
      matchedRate: toPercent(attributed, inCurrency.length),
    },
    mixedCurrencies,
    sources,
    series: [...byDay].map(([date, value]) => ({ date, revenue: toMoney(value) })),
  };
}
