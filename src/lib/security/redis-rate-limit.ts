/**
 * Redis-backed rate limiter for the Edge/Node middleware chokepoint.
 *
 * Design goals:
 *   - GLOBAL: one shared counter across the app + all worker containers
 *     (the in-memory limiter in rate-limiter.ts is per-process and resets on
 *     restart, so it can't stop a distributed scan).
 *   - FAIL-OPEN: if Redis is disabled, unreachable, or errors, requests are
 *     ALWAYS allowed. A rate limiter must never take the site down — this is a
 *     hard rule after the IPv6/login outage.
 *   - CHEAP: a single atomic INCR + conditional EXPIRE per request (fixed
 *     window). No Lua, no extra round-trips.
 *
 * This uses its own short-lived IORedis connection tuned to give up fast so a
 * Redis hiccup adds at most ~150ms before failing open.
 */

import IORedis from "ioredis";
import { REDIS_ENABLED, REDIS_URL } from "../redis/enabled";

declare global {
  // eslint-disable-next-line no-var
  var _rateLimitRedis: IORedis | undefined;
}

function getClient(): IORedis | null {
  if (!REDIS_ENABLED) return null;
  if (globalThis._rateLimitRedis) return globalThis._rateLimitRedis;

  const client = new IORedis(REDIS_URL || "redis://localhost:6379", {
    // Fail fast: we never want rate-limiting to add latency or hang a request.
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    connectTimeout: 1000,
    commandTimeout: 150, // hard cap — fail open rather than wait on Redis
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });

  // Swallow connection errors — they must not crash the middleware.
  let lastLog = 0;
  client.on("error", (err) => {
    const now = Date.now();
    if (now - lastLog > 60_000) {
      console.error("[RateLimit:redis] error (failing open):", err.message);
      lastLog = now;
    }
  });

  globalThis._rateLimitRedis = client;
  return client;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfter: number; // seconds until the window resets (0 when allowed)
}

/**
 * Fixed-window rate limit check.
 *
 * @param key       Unique bucket key, e.g. `rl:auth:1.2.3.4`
 * @param limit     Max requests allowed in the window
 * @param windowSec Window length in seconds
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const allow = (): RateLimitResult => ({
    allowed: true,
    remaining: limit,
    limit,
    retryAfter: 0,
  });

  const client = getClient();
  if (!client) return allow(); // Redis disabled → fail open

  try {
    const redisKey = `rl:${key}`;
    // INCR returns the new count. On the first hit (count === 1) we set the TTL,
    // which starts the window. Subsequent hits in the same window just increment.
    const count = await client.incr(redisKey);
    if (count === 1) {
      await client.expire(redisKey, windowSec);
    }

    if (count > limit) {
      // Find how long until the window resets so we can send Retry-After.
      let ttl = await client.ttl(redisKey);
      if (ttl < 0) ttl = windowSec; // key had no TTL somehow — reset it
      return { allowed: false, remaining: 0, limit, retryAfter: ttl };
    }

    return { allowed: true, remaining: Math.max(0, limit - count), limit, retryAfter: 0 };
  } catch (err) {
    // Any Redis failure (timeout, disconnect) → fail open.
    return allow();
  }
}
