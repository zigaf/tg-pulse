import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPrisma } from '@tgpulse/db';
import { assertWorkspaceAccess } from '@/server/access';
import { getSessionUserId } from '@/server/auth';
import { getEntitlements, getUsage } from '@/server/entitlements';
import { handleRouteError, jsonError, jsonOk, parseOrThrow } from '@/server/http';

export const runtime = 'nodejs';

/** Read-only billing view; upgrading happens in the bot (docs/BILLING.md). */

const PAYMENT_HISTORY_LIMIT = 10;

const paramsSchema = z.object({ id: z.string().trim().min(1) });

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id: workspaceId } = parseOrThrow(paramsSchema, await ctx.params);
    await assertWorkspaceAccess(userId, workspaceId);

    const [entitlements, usage, payments] = await Promise.all([
      getEntitlements(workspaceId),
      getUsage(workspaceId),
      getPrisma().paymentEvent.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: PAYMENT_HISTORY_LIMIT,
        // Narrow select on purpose: payerTgId is a BigInt and payload may hold provider internals.
        select: { id: true, plan: true, amount: true, currency: true, createdAt: true },
      }),
    ]);

    return jsonOk({
      plan: entitlements.plan,
      limits: entitlements.limits,
      features: entitlements.features,
      usage,
      subscription: entitlements.subscription,
      payments,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
