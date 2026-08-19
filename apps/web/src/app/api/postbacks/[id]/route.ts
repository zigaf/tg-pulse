import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPrisma } from '@tgpulse/db';
import { getSessionUserId } from '@/server/auth';
import { assertChannelFeature } from '@/server/entitlements';
import { ApiError, handleRouteError, jsonError, jsonOk, parseOrThrow, readJsonBody } from '@/server/http';
import { assertPostbackAccess, assertValidUrlTemplate, toPostbackDto } from '@/server/postbacks';

export const runtime = 'nodejs';

const updatePostbackSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  urlTemplate: z.string().trim().min(1).max(2048).optional(),
  onJoin: z.boolean().optional(),
  onLeave: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id } = await ctx.params;
    const postback = await assertPostbackAccess(userId, id);
    await assertChannelFeature(postback.channelId, 'postbacks');

    const body = parseOrThrow(updatePostbackSchema, await readJsonBody(req));
    if (Object.keys(body).length === 0) {
      throw new ApiError(400, 'Nothing to update');
    }

    const onJoin = body.onJoin ?? postback.onJoin;
    const onLeave = body.onLeave ?? postback.onLeave;
    if (!onJoin && !onLeave) {
      throw new ApiError(400, 'Postback must fire on at least one event (join or leave)');
    }
    if (body.urlTemplate !== undefined) {
      assertValidUrlTemplate(body.urlTemplate);
    }

    const updated = await getPrisma().postback.update({
      where: { id: postback.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.urlTemplate !== undefined ? { urlTemplate: body.urlTemplate } : {}),
        ...(body.onJoin !== undefined ? { onJoin: body.onJoin } : {}),
        ...(body.onLeave !== undefined ? { onLeave: body.onLeave } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    });

    return jsonOk(toPostbackDto(updated));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id } = await ctx.params;
    const postback = await assertPostbackAccess(userId, id);
    await assertChannelFeature(postback.channelId, 'postbacks');

    await getPrisma().postback.delete({ where: { id: postback.id } });

    return jsonOk({ id: postback.id });
  } catch (error) {
    return handleRouteError(error);
  }
}
