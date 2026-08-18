import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import { TelegramApiError } from './telegram';

/** Error carrying an HTTP status; thrown by server helpers, mapped by handleRouteError. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, init);
}

export function jsonError(status: number, error: string): NextResponse {
  return NextResponse.json({ ok: false, error }, { status });
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

/** Map thrown errors to the { ok: false, error } envelope without leaking stack traces. */
export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return jsonError(error.status, error.message);
  }
  if (error instanceof TelegramApiError) {
    console.error('[api] Telegram API error:', error.description);
    return jsonError(502, `Telegram API error: ${error.description}`);
  }
  console.error('[api] Unhandled error:', error);
  return jsonError(500, 'Internal server error');
}
