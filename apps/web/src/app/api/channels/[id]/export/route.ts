import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { assertChannelAccess } from '@/server/access';
import { REPORT_PERIODS, parseDaysParam } from '@/server/analytics';
import { getSessionUserId } from '@/server/auth';
import { getEntitlements, exportRowLimit } from '@/server/entitlements';
import { buildChannelExport, EXPORT_TYPES } from '@/server/exports';
import { handleRouteError, jsonError, parseOrThrow } from '@/server/http';

export const runtime = 'nodejs';

const querySchema = z.object({
  type: z.enum(EXPORT_TYPES),
});

/**
 * CSV export (docs/PHASE7-BUILD.md §3). Reading is allowed for every member, including
 * viewers — the export is a read of data they can already see in the dashboard.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id: channelId } = await ctx.params;
    const channel = await assertChannelAccess(userId, channelId);

    const sp = req.nextUrl.searchParams;
    const { type } = parseOrThrow(querySchema, { type: sp.get('type') ?? undefined });
    // No `days` means the whole history; a supplied value must be a known window.
    const rawDays = sp.get('days');
    const days = rawDays === null ? null : parseDaysParam(rawDays, REPORT_PERIODS);

    const { plan } = await getEntitlements(channel.workspaceId);
    const result = await buildChannelExport(channel, type, days, exportRowLimit(plan));

    const headers = new Headers({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Cache-Control': 'no-store',
      'X-Export-Rows': String(result.rowCount),
    });
    // Tells the dashboard to show the "upgrade for the full export" note.
    if (result.truncated) headers.set('X-Export-Truncated', 'true');

    return new NextResponse(result.csv, { headers });
  } catch (error) {
    return handleRouteError(error);
  }
}
