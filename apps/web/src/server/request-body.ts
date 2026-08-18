import { ApiError } from './http';

/**
 * Size-capped body readers for endpoints that accept bulk payloads
 * (sales webhook, CSV import). Rejects with 413 before parsing.
 */

/** Read the body as text, refusing payloads larger than `maxBytes`. */
export async function readTextBodyWithLimit(req: Request, maxBytes: number): Promise<string> {
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ApiError(413, `Request body too large (max ${maxBytes} bytes)`);
  }

  let text: string;
  try {
    text = await req.text();
  } catch {
    throw new ApiError(400, 'Invalid request body');
  }

  // Content-Length may be absent or wrong (chunked transfer), so re-check the real size.
  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    throw new ApiError(413, `Request body too large (max ${maxBytes} bytes)`);
  }

  return text;
}

/** Read and parse a JSON body, refusing payloads larger than `maxBytes`. */
export async function readJsonBodyWithLimit(req: Request, maxBytes: number): Promise<unknown> {
  const text = await readTextBodyWithLimit(req, maxBytes);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(400, 'Invalid JSON body');
  }
}
