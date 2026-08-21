import type { NextRequest } from 'next/server';
import { buildChannelReport } from '@/server/analytics';
import { handleRouteError, jsonOk } from '@/server/http';
import { clientIp, enforceRateLimit } from '@/server/rate-limit';
import { recordShareView, resolvePublicShareLink, resolveReportBrand } from '@/server/share-links';

export const runtime = 'nodejs';

/** Each open runs a full aggregation, so an unauthenticated caller gets a budget. */
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
/** Numbers must be current on every open, and the response is per-token anyway. */
export const dynamic = 'force-dynamic';

/**
 * Public read-only report (docs/PHASE7-BUILD.md §2). No session, no cookies.
 *
 * The payload is deliberately narrow: channel name, window, aggregate totals, the daily
 * series and the source breakdown by label. It must never carry subscriber identities,
 * revenue, API keys, member data or internal ids.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    enforceRateLimit(`share:${clientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS);
    const share = await resolvePublicShareLink(token);

    const [report, brand] = await Promise.all([
      buildChannelReport(share.channel.id, share.windowDays),
      resolveReportBrand(share.workspaceId),
    ]);

    // Counting a view must never delay or break the report.
    recordShareView(share.id);

    return jsonOk({
      channel: { title: share.channel.title, username: share.channel.username },
      // Agency white-label: the report page renders this identity instead of TGPulse.
      brand,
      label: share.label,
      windowDays: share.windowDays,
      generatedAt: new Date(),
      totals: report.totals,
      series: report.series,
      sources: report.sources.map((source) => ({
        label: source.label,
        clicks: source.clicks,
        joins: source.joins,
        leaves: source.leaves,
        unsubRate: source.unsubRate,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
