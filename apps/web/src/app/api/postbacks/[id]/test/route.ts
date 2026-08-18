import type { NextRequest } from 'next/server';
import { getSessionUserId } from '@/server/auth';
import { handleRouteError, jsonError, jsonOk } from '@/server/http';
import { assertPublicHttpUrl } from '@/server/net-guard';
import { assertPostbackAccess, renderPostbackTemplate, TEST_MACRO_VALUES } from '@/server/postbacks';

export const runtime = 'nodejs';

const TEST_TIMEOUT_MS = 5000;

/** Fire the postback once with test macro values and report the upstream HTTP status. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id } = await ctx.params;
    const postback = await assertPostbackAccess(userId, id);

    const url = renderPostbackTemplate(postback.urlTemplate, TEST_MACRO_VALUES);

    // SSRF guard: the template is user input fetched server-side
    try {
      await assertPublicHttpUrl(url);
    } catch (error) {
      return jsonError(400, `URL not allowed: ${error instanceof Error ? error.message : 'invalid'}`);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store',
        signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
      });
    } catch (error) {
      const isTimeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      const detail = isTimeout
        ? `no response within ${TEST_TIMEOUT_MS / 1000}s`
        : 'connection failed (DNS, TLS or refused)';
      return jsonError(502, `Postback endpoint unreachable: ${detail}`);
    }

    return jsonOk({ status: response.status });
  } catch (error) {
    return handleRouteError(error);
  }
}
