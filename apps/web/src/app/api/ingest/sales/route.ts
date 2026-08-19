import { z } from 'zod';
import { SaleKind } from '@tgpulse/db';
import { bearerTokenFrom, verifyApiKey } from '@/server/api-keys';
import { assertFeature } from '@/server/entitlements';
import { ApiError, handleRouteError, jsonError, jsonOk, parseOrThrow } from '@/server/http';
import { readJsonBodyWithLimit } from '@/server/request-body';
import {
  DEFAULT_CURRENCY,
  MAX_SALE_EVENTS_PER_REQUEST,
  parseAmount,
  parseCurrency,
  parseExternalId,
  parseKind,
  parseOccurredAt,
  parseTgUserId,
  parseUsername,
  recordSaleEvents,
  SALE_KINDS,
  type SaleEventInput,
} from '@/server/sales';

export const runtime = 'nodejs';

/** 500 events of realistic size fit comfortably; anything larger is rejected with 413. */
const MAX_BODY_BYTES = 512 * 1024;

const saleEventSchema = z
  .object({
    tgUserId: z.union([z.string(), z.number()]).optional(),
    username: z.string().optional(),
    amount: z.number(),
    currency: z.string().optional(),
    kind: z.enum(SALE_KINDS).optional(),
    externalId: z.string().optional(),
    occurredAt: z.string().optional(),
  })
  .refine((event) => event.tgUserId !== undefined || event.username !== undefined, {
    message: 'either tgUserId or username is required',
  });

const ingestSchema = z.object({
  events: z.array(saleEventSchema).min(1).max(MAX_SALE_EVENTS_PER_REQUEST),
});

type RawSaleEvent = z.infer<typeof saleEventSchema>;

/** Reuse the shared field parsers, but prefix failures with the offending index. */
function toSaleEventInput(event: RawSaleEvent, index: number): SaleEventInput {
  try {
    return {
      tgUserId: event.tgUserId === undefined ? null : parseTgUserId(event.tgUserId),
      username: event.username === undefined ? null : parseUsername(event.username),
      amount: parseAmount(event.amount),
      currency: event.currency === undefined ? DEFAULT_CURRENCY : parseCurrency(event.currency),
      kind: event.kind === undefined ? SaleKind.PURCHASE : parseKind(event.kind),
      externalId: event.externalId === undefined ? null : parseExternalId(event.externalId),
      occurredAt: event.occurredAt === undefined ? new Date() : parseOccurredAt(event.occurredAt),
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw new ApiError(error.status, `events[${index}]: ${error.message}`);
    }
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    // Server-to-server auth: an ingest key, never a browser session.
    const token = bearerTokenFrom(req);
    const channel = token ? await verifyApiKey(token) : null;
    // Deliberately uniform: never reveal whether the key is missing, malformed or revoked.
    if (!channel) return jsonError(401, 'Unauthorized');

    // Keys are not issued on FREE, but a downgraded workspace may still hold an old one:
    // authenticate first, then answer 402 so the caller knows why ingest stopped working.
    await assertFeature(channel.workspaceId, 'revenue');

    const body = parseOrThrow(ingestSchema, await readJsonBodyWithLimit(req, MAX_BODY_BYTES));
    const inputs = body.events.map(toSaleEventInput);

    const result = await recordSaleEvents(channel.id, inputs);

    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
