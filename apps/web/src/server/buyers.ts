import { buildChannelReport, unsubRate } from './analytics';
import { buildRevenueReport } from './revenue';

/**
 * Buyer comparison (docs/PHASE7-BUILD.md §4).
 *
 * Rolls the per-link source breakdown up by `TrackedLink.buyer`. Links with no buyer
 * collapse into one "Unassigned" row; organic joins belong to no buyer at all and are
 * excluded. Revenue is only joined in when the workspace has the revenue module, and
 * `costPerJoin` stays null until buyers report spend (shape kept ready on purpose).
 */

export const UNASSIGNED_BUYER_LABEL = 'Unassigned';

/** Revenue rows arrive already rounded; re-rounding keeps float sums out of the payload. */
const MONEY_SCALE = 2;

export interface BuyerRow {
  /** `null` on the "Unassigned" row: links created without a buyer tag. */
  buyer: string | null;
  label: string;
  links: number;
  clicks: number;
  joins: number;
  leaves: number;
  unsubRate: number;
  /** Present only when the revenue module is enabled for the workspace. */
  revenue?: number;
  /** Reserved for reported ad spend; always null today. */
  costPerJoin: number | null;
}

export interface BuyerComparison {
  days: number;
  /** Currency of the `revenue` column; null when revenue is not included. */
  currency: string | null;
  buyers: BuyerRow[];
}

interface Accumulator {
  buyer: string | null;
  links: number;
  clicks: number;
  joins: number;
  leaves: number;
  revenue: number;
}

function emptyRow(buyer: string | null): Accumulator {
  return { buyer, links: 0, clicks: 0, joins: 0, leaves: 0, revenue: 0 };
}

export async function buildBuyerComparison(
  channelId: string,
  days: number,
  includeRevenue: boolean,
): Promise<BuyerComparison> {
  const [report, revenue] = await Promise.all([
    buildChannelReport(channelId, days),
    includeRevenue ? buildRevenueReport(channelId, days) : null,
  ]);

  const revenueByLink = new Map(
    (revenue?.sources ?? []).map((source) => [source.linkId, source.revenue]),
  );

  const byBuyer = new Map<string | null, Accumulator>();
  for (const source of report.sources) {
    // Organic (no link) cannot be credited to anyone.
    if (source.linkId === null) continue;

    const key = source.buyer ?? null;
    const row = byBuyer.get(key) ?? emptyRow(key);
    row.links += 1;
    row.clicks += source.clicks;
    row.joins += source.joins;
    row.leaves += source.leaves;
    row.revenue += revenueByLink.get(source.linkId) ?? 0;
    byBuyer.set(key, row);
  }

  const buyers: BuyerRow[] = [...byBuyer.values()].map((row) => ({
    buyer: row.buyer,
    label: row.buyer ?? UNASSIGNED_BUYER_LABEL,
    links: row.links,
    clicks: row.clicks,
    joins: row.joins,
    leaves: row.leaves,
    unsubRate: unsubRate(row.joins, row.leaves),
    ...(includeRevenue ? { revenue: Number(row.revenue.toFixed(MONEY_SCALE)) } : {}),
    costPerJoin: null,
  }));

  buyers.sort(
    (a, b) => (b.revenue ?? 0) - (a.revenue ?? 0) || b.joins - a.joins || b.clicks - a.clicks,
  );

  return {
    days,
    currency: revenue?.totals.currency ?? null,
    buyers,
  };
}
