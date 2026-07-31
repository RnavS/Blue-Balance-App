import type { Context, Next } from 'hono';
import { HttpError } from './errors.js';

/**
 * Fixed-window rate limiter held in memory.
 *
 * No Redis, no configuration, nothing to provision — it works on a fresh clone
 * and on a single deployed instance, which is what this app runs on. The limit
 * is per instance, so scaling to several instances multiplies the effective
 * ceiling; move to a shared store if that ever happens.
 *
 * The point is to make credential stuffing and password-reset spam expensive,
 * not to be a precise quota system.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Stale buckets would otherwise accumulate for every IP ever seen.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, SWEEP_INTERVAL_MS);

// Don't hold the event loop open just for cleanup.
sweeper.unref?.();

function clientKey(c: Context): string {
  // Hosts put the real client address in x-forwarded-for; the first entry is the
  // originating client. Falls back to a constant, which degrades to a global
  // limit rather than no limit.
  const forwarded = c.req.header('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'unknown';
  return ip;
}

export function rateLimit(options: { name: string; limit: number; windowMs: number }) {
  const { name, limit, windowMs } = options;

  return async (c: Context, next: Next) => {
    const key = `${name}:${clientKey(c)}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      await next();
      return;
    }

    bucket.count += 1;

    if (bucket.count > limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      throw new HttpError(429, 'Too many attempts. Please wait a moment and try again.', {
        error: 'rate_limited',
        retryAfterSeconds,
      });
    }

    await next();
  };
}
