import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import { TelegramApiError } from './telegram';

/** Extra fields merged into an error envelope, e.g. `{ upgrade: true }` on a 402 plan gate. */
export type ErrorExtra = Readonly<Record<string, unknown>>;

/** Error carrying an HTTP status; thrown by server helpers, mapped by handleRouteError. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Merged into the response body alongside `ok` and `error`. */
    public readonly extra?: ErrorExtra,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, init);
}

export function jsonError(status: number, error: string, extra?: ErrorExtra): NextResponse {
  // Envelope fields are written last so `extra` can never clobber them.
  return NextResponse.json({ ...extra, ok: false, error }, { status });
}

/** Validate unknown input against a zod schema; throws ApiError(400) with a readable message. */
export function parseOrThrow<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => {
        const path = issue.path.map(String).join('.');
        return path ? `${path}: ${issue.message}` : issue.message;
      })
      .join('; ');
    throw new ApiError(400, `Validation failed: ${detail}`);
  }
  return result.data;
}

/** Parse a JSON request body or throw a 400. */
export async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, 'Invalid JSON body');
  }
}

/**
 * Origin this request was addressed to, honouring the proxy headers the platform sets.
 *
 * Only used to render links back to this app for the caller who just asked for them,
 * never for a trust decision — `Host` is client-controlled.
 */
export function requestOrigin(req: Request): string {
  const firstValue = (raw: string | null): string | null => {
    const value = raw?.split(',')[0]?.trim();
    return value ? value : null;
  };

  const host =
    firstValue(req.headers.get('x-forwarded-host')) ?? firstValue(req.headers.get('host'));
  if (host) {
    const proto =
      firstValue(req.headers.get('x-forwarded-proto')) ??
      (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    return `${proto}://${host}`;
  }

  return new URL(req.url).origin;
}

/** Map thrown errors to the { ok: false, error } envelope without leaking stack traces. */
export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return jsonError(error.status, error.message, error.extra);
  }
  if (error instanceof TelegramApiError) {
    console.error('[api] Telegram API error:', error.description);
    return jsonError(502, `Telegram API error: ${error.description}`);
  }
  console.error('[api] Unhandled error:', error);
  return jsonError(500, 'Internal server error');
}
