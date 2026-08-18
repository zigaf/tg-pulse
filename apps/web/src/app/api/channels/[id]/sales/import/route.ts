import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { assertChannelAccess } from '@/server/access';
import { getSessionUserId } from '@/server/auth';
import { ApiError, handleRouteError, jsonError, jsonOk, parseOrThrow } from '@/server/http';
import { readJsonBodyWithLimit } from '@/server/request-body';
import { parseSalesCsv, recordSaleEvents } from '@/server/sales';

export const runtime = 'nodejs';

const MAX_CSV_BYTES = 1024 * 1024;
/** The CSV travels inside a JSON envelope, so allow a little room for escaping. */
const MAX_BODY_BYTES = MAX_CSV_BYTES + 64 * 1024;
/** Only the first errors are returned; the rest would not fit a useful UI. */
const MAX_REPORTED_ERRORS = 20;

const importSchema = z.object({
  csv: z.string().min(1),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id: channelId } = await ctx.params;
    await assertChannelAccess(userId, channelId);

    const body = parseOrThrow(importSchema, await readJsonBodyWithLimit(req, MAX_BODY_BYTES));
    if (Buffer.byteLength(body.csv, 'utf8') > MAX_CSV_BYTES) {
      throw new ApiError(413, `CSV must not exceed ${MAX_CSV_BYTES} bytes`);
    }

    const { inputs, errors } = parseSalesCsv(body.csv);
    const result = await recordSaleEvents(channelId, inputs);

    return jsonOk({
      accepted: result.accepted,
      matched: result.matched,
      errors: errors.slice(0, MAX_REPORTED_ERRORS),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
