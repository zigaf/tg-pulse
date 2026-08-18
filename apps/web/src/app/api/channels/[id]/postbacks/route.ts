import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPrisma } from '@tgpulse/db';
import { assertChannelAccess } from '@/server/access';
import { getSessionUserId } from '@/server/auth';
import { ApiError, handleRouteError, jsonError, jsonOk, parseOrThrow, readJsonBody } from '@/server/http';
import { assertValidUrlTemplate, toPostbackDto } from '@/server/postbacks';

export const runtime = 'nodejs';

const createPostbackSchema = z.object({
  name: z.string().trim().min(1).max(64),
  urlTemplate: z.string().trim().min(1).max(2048),
  onJoin: z.boolean().default(true),
  onLeave: z.boolean().default(false),
});

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id: channelId } = await ctx.params;
    await assertChannelAccess(userId, channelId);

    const postbacks = await getPrisma().postback.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
    });

    return jsonOk(postbacks.map(toPostbackDto));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUserId(req.cookies);
    if (!userId) return jsonError(401, 'Unauthorized');

    const { id: channelId } = await ctx.params;
    await assertChannelAccess(userId, channelId);

    const body = parseOrThrow(createPostbackSchema, await readJsonBody(req));
    if (!body.onJoin && !body.onLeave) {
      throw new ApiError(400, 'Postback must fire on at least one event (join or leave)');
    }
    assertValidUrlTemplate(body.urlTemplate);

    const postback = await getPrisma().postback.create({
      data: {
        channelId,
        name: body.name,
        urlTemplate: body.urlTemplate,
        onJoin: body.onJoin,
        onLeave: body.onLeave,
      },
    });

    return jsonOk(toPostbackDto(postback));
  } catch (error) {
    return handleRouteError(error);
  }
}
