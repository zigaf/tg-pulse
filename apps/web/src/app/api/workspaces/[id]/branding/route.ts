import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPrisma } from '@tgpulse/db';
import { getSessionUserId } from '@/server/auth';
import { assertFeature } from '@/server/entitlements';
import { handleRouteError, jsonError, jsonOk, parseOrThrow, readJsonBody } from '@/server/http';
import { assertCanMutateWorkspace } from '@/server/roles';

export const runtime = 'nodejs';

/**
 * White-label identity shown on public client reports instead of TGPulse
 * (Agency feature). Stored on the workspace; the public share route re-checks
 * the entitlement on every open, so a lapsed plan drops the branding by itself.
 */

const MAX_NAME_LENGTH = 60;
const MAX_URL_LENGTH = 200;

/** Empty strings clear a field; the URL must be plain http(s) so the report never links to javascript:. */
const brandingSchema = z.object({
  brandName: z.string().trim().max(MAX_NAME_LENGTH, 'Brand name is too long'),
  brandUrl: z
    .string()
    .trim()
    .max(MAX_URL_LENGTH, 'Brand link is too long')
    .refine(
      (value) => value === '' || /^https?:\/\/\S+$/i.test(value),
      'Brand link must be an http(s) URL',
    ),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id: workspaceId } = await ctx.params;
    await assertCanMutateWorkspace(userId, workspaceId);

    const body = parseOrThrow(brandingSchema, await readJsonBody(req));
    const brandName = body.brandName || null;
    const brandUrl = body.brandUrl || null;

    // Clearing the branding stays allowed on any plan; setting it is the Agency feature.
    if (brandName !== null || brandUrl !== null) {
      await assertFeature(workspaceId, 'whiteLabel');
    }
    if (brandUrl !== null && brandName === null) {
      return jsonError(400, 'A brand link needs a brand name to attach to');
    }

    const workspace = await getPrisma().workspace.update({
      where: { id: workspaceId },
      data: { brandName, brandUrl },
      select: { id: true, brandName: true, brandUrl: true },
    });

    return jsonOk(workspace);
  } catch (error) {
    return handleRouteError(error);
  }
}
