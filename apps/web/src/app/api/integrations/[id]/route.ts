import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPrisma } from '@tgpulse/db';
import type { AdProvider } from '@/lib/ad-providers';
import { getSessionUserId } from '@/server/auth';
import { isEncryptionConfigured } from '@/server/crypto';
import { assertChannelFeature } from '@/server/entitlements';
import { ApiError, handleRouteError, jsonError, jsonOk, parseOrThrow, readJsonBody } from '@/server/http';
import {
  assertIntegrationAccess,
  assertProviderAvailable,
  encryptCredentials,
  providerSpec,
  toIntegrationDto,
} from '@/server/integrations';
import { assertCanMutateChannel } from '@/server/roles';

export const runtime = 'nodejs';

const updateIntegrationSchema = z.object({
  isActive: z.boolean().optional(),
  sendJoins: z.boolean().optional(),
  /** Full replacement when present; the stored secret is untouched when omitted. */
  credentials: z.record(z.string(), z.string()).optional(),
  /** Full replacement when present, so a partial config can never leave a half-valid row. */
  config: z.record(z.string(), z.unknown()).optional(),
});

/** Toggle active state, rotate credentials or edit the non-secret config. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id } = await ctx.params;
    const integration = await assertIntegrationAccess(userId, id);
    await assertCanMutateChannel(userId, integration.channelId);
    await assertChannelFeature(integration.channelId, 'postbacks');

    const body = parseOrThrow(updateIntegrationSchema, await readJsonBody(req));
    if (Object.keys(body).length === 0) {
      throw new ApiError(400, 'Nothing to update');
    }

    const provider = integration.provider as AdProvider;
    assertProviderAvailable(provider);
    const spec = providerSpec(provider);

    if (body.credentials !== undefined && !isEncryptionConfigured()) {
      throw new ApiError(500, 'Credential encryption is not configured on this server');
    }

    const credentials =
      body.credentials === undefined ? null : encryptCredentials(spec.parseCredentials(body.credentials));
    const config = body.config === undefined ? null : spec.parseConfig(body.config);
    const isReconnect = credentials !== null || config !== null;

    const updated = await getPrisma().adIntegration.update({
      where: { id: integration.id },
      data: {
        ...(body.isActive === undefined ? {} : { isActive: body.isActive }),
        ...(body.sendJoins === undefined ? {} : { sendJoins: body.sendJoins }),
        ...(credentials === null ? {} : { credentials }),
        ...(config === null ? {} : { config }),
        // New credentials or settings invalidate the previous failure; a plain toggle keeps it.
        ...(isReconnect ? { lastStatus: null, lastError: null } : {}),
      },
    });

    return jsonOk(toIntegrationDto(updated));
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Removing the connection also drops its pending uploads (cascade on ConversionUpload). */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id } = await ctx.params;
    const integration = await assertIntegrationAccess(userId, id);
    await assertCanMutateChannel(userId, integration.channelId);
    await assertChannelFeature(integration.channelId, 'postbacks');

    await getPrisma().adIntegration.delete({ where: { id: integration.id } });

    return jsonOk({ id: integration.id });
  } catch (error) {
    return handleRouteError(error);
  }
}
