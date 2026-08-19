import { ApiError } from './http';

/**
 * Fixed-window limiter for public endpoints. In-memory by design: the app runs as a
 * single instance, and the goal is to blunt cheap abuse, not to be a distributed quota.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/** Throws 429 once `limit` requests for the key are seen inside the window. */
export function enforceRateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) sweep(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    throw new ApiError(429, 'Too many requests, try again shortly');
  }
}

/** Best-effort client address behind Railway's proxy. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}
