import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPrisma, type AdProvider as PrismaAdProvider } from '@tgpulse/db';
import { isAdProvider, type AdProvider } from '@/lib/ad-providers';
import { assertChannelAccess } from '@/server/access';
import { getSessionUserId } from '@/server/auth';
import { isEncryptionConfigured } from '@/server/crypto';
import { assertFeature } from '@/server/entitlements';
import { ApiError, handleRouteError, jsonError, jsonOk, parseOrThrow, readJsonBody } from '@/server/http';
import {
  assertProviderAvailable,
  encryptCredentials,
  providerSpec,
  toIntegrationDto,
} from '@/server/integrations';
import { assertCanMutateChannel } from '@/server/roles';

export const runtime = 'nodejs';

const saveIntegrationSchema = z.object({
  provider: z.custom<AdProvider>(isAdProvider, { message: 'Unknown ad platform' }),
  /** Per-provider shape; validated again by the provider spec. Omitted on an update that keeps the secret. */
  credentials: z.record(z.string(), z.string()).optional(),
  config: z.record(z.string(), z.unknown()).default({}),
  isActive: z.boolean().default(true),
  sendJoins: z.boolean().default(true),
});

/** Listing stays open on FREE so a downgraded workspace still sees what it connected. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id: channelId } = await ctx.params;
    await assertChannelAccess(userId, channelId);

    const integrations = await getPrisma().adIntegration.findMany({
      where: { channelId },
      orderBy: { createdAt: 'asc' },
    });

    return jsonOk(integrations.map(toIntegrationDto));
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * Connect or reconnect one platform. The schema keeps a single row per (channel, provider),
 * so this is an upsert: reconnecting replaces the credentials instead of piling up rows.
 * Credentials may be omitted on an update, which keeps the stored secret untouched.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id: channelId } = await ctx.params;
    const channel = await assertCanMutateChannel(userId, channelId);
    await assertFeature(channel.workspaceId, 'postbacks');

    if (!isEncryptionConfigured()) {
      throw new ApiError(500, 'Credential encryption is not configured on this server');
    }

    const body = parseOrThrow(saveIntegrationSchema, await readJsonBody(req));
    assertProviderAvailable(body.provider);

    const spec = providerSpec(body.provider);
    const config = spec.parseConfig(body.config);
    const provider = body.provider as PrismaAdProvider;

    const prisma = getPrisma();
    const existing = await prisma.adIntegration.findUnique({
      where: { channelId_provider: { channelId, provider } },
    });

    const credentials =
      body.credentials === undefined
        ? null
        : encryptCredentials(spec.parseCredentials(body.credentials));

    if (!existing) {
      if (credentials === null) {
        throw new ApiError(400, 'Credentials are required to connect this platform');
      }
      const created = await prisma.adIntegration.create({
        data: {
          channelId,
          provider,
          credentials,
          config,
          isActive: body.isActive,
          sendJoins: body.sendJoins,
        },
      });
      return jsonOk(toIntegrationDto(created));
    }

    const updated = await prisma.adIntegration.update({
      where: { id: existing.id },
      data: {
        ...(credentials === null ? {} : { credentials }),
        config,
        isActive: body.isActive,
        sendJoins: body.sendJoins,
        // A reconnect clears the old failure so the health block is not stuck on it.
        lastStatus: null,
        lastError: null,
      },
    });

    return jsonOk(toIntegrationDto(updated));
  } catch (error) {
    return handleRouteError(error);
  }
}
