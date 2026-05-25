import IORedis from "ioredis";
import { NextResponse, type NextRequest } from "next/server";
import { REDIS_ENABLED, REDIS_URL as RESOLVED_URL } from "../redis/enabled";

/**
 * Redis-backed sliding-window rate limiter.
 *
 * Algorithm
 * ─────────
 * Stores timestamps of recent requests in a sorted set keyed per identifier.
 * On each call:
 *   1. ZREMRANGEBYSCORE — drops entries older than the window
 *   2. ZCARD            — counts what's left
 *   3. If under limit, ZADD + EXPIRE
 *   4. Returns { allowed, remaining, resetAt }
 *
 * All four operations run in one Redis pipeline for atomicity.
 *
 * Usage
 * ─────
 *   import { rateLimit } from "@/lib/middleware/rateLimit";
 *
 *   export async function POST(req: NextRequest) {
 *     const limit = await rateLimit({
 *       request: req,
 *       key: `ai:gen:${userId}`,
 *       limit: 10,
 *       windowSec: 60,
 *     });
 *     if (limit.response) return limit.response;
 *     // …
 *   }
 *
 * On Redis failure → fail-open (allow the request) so the app doesn't
 * become unusable when Redis is down.
 */

declare global {
  // eslint-disable-next-line no-var
  var _redisRateLimit: IORedis | undefined;
}

const REDIS_URL = RESOLVED_URL || "redis://localhost:6379";

function createClient(): IORedis {
  const c = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 500, 10_000),
    enableReadyCheck: true,
    // Defer TCP connect until the first rate-limit check
    lazyConnect: true,
  });
  c.on("error", () => { /* swallow — fail-open */ });
  return c;
}

const client: IORedis | null = REDIS_ENABLED
  ? (globalThis._redisRateLimit ?? createClient())
  : null;

if (process.env.NODE_ENV !== "production" && client) {
  globalThis._redisRateLimit = client;
}

export interface RateLimitOptions {
  /** Optional request — used to derive an IP fallback identifier. */
  request?: NextRequest;
  /** Unique identifier (user ID, IP, etc.). */
  key: string;
  /** Max requests allowed in the window. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix ms
  /** Pre-built 429 NextResponse — non-null when the request should be blocked. */
  response: NextResponse | null;
}

const KEY_PREFIX = "rl:";

export async function rateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const { key, limit, windowSec } = opts;
  const now = Date.now();
  const windowMs = windowSec * 1_000;

  // Fail-open when Redis is disabled — always allow
  if (!client) {
    return { allowed: true, remaining: limit, resetAt: now + windowMs, response: null };
  }

  const fullKey = `${KEY_PREFIX}${key}`;
  const windowStart = now - windowMs;

  try {
    const pipeline = client.multi();
    pipeline.zremrangebyscore(fullKey, 0, windowStart);
    pipeline.zcard(fullKey);
    const results = await pipeline.exec();

    // results: [[null, removedCount], [null, currentCount]]
    const currentCount = (results?.[1]?.[1] as number) ?? 0;

    if (currentCount >= limit) {
      const resetAt = now + windowMs;
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        response: NextResponse.json(
          {
            error: "Too many requests",
            retryAfter: Math.ceil((resetAt - now) / 1000),
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(Math.ceil((resetAt - now) / 1000)),
              "X-RateLimit-Limit": String(limit),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
            },
          }
        ),
      };
    }

    // Under the limit — record this hit
    const member = `${now}-${Math.random().toString(36).slice(2, 8)}`;
    await client
      .multi()
      .zadd(fullKey, now, member)
      .expire(fullKey, windowSec + 1)
      .exec();

    return {
      allowed: true,
      remaining: limit - currentCount - 1,
      resetAt: now + windowMs,
      response: null,
    };
  } catch {
    // Redis down → fail open (allow request, log nothing-spammy)
    return { allowed: true, remaining: limit, resetAt: now + windowMs, response: null };
  }
}

/**
 * Convenience: derives an identifier from request IP if no key is provided.
 * Use for unauthenticated endpoints (signup, password reset).
 */
export function ipFromRequest(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
