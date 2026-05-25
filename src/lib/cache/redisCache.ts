import IORedis from "ioredis";
import { REDIS_ENABLED, REDIS_URL as RESOLVED_URL } from "../redis/enabled";

/**
 * Redis caching helpers.
 *
 * Uses a dedicated connection so cache reads never compete with pub/sub or
 * BullMQ's blocking commands.
 *
 * Usage
 * ─────
 *   const overview = await cached(
 *     `parent:overview:${userId}`,
 *     60,                            // TTL in seconds
 *     () => fetchExpensiveOverview(userId)
 *   );
 *
 *   await invalidate(`parent:overview:${userId}`);
 *   await invalidatePattern("parent:overview:*");
 */

declare global {
  // eslint-disable-next-line no-var
  var _redisCache: IORedis | undefined;
}

const REDIS_URL = RESOLVED_URL || "redis://localhost:6379";

const LOG_THROTTLE_MS = 60_000;

function createCacheClient(): IORedis {
  const client = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 500, 10_000),
    enableReadyCheck: true,
    // Defer TCP connect until the first cache read/write
    lazyConnect: true,
  });

  let lastError = "";
  let lastErrorAt = 0;
  client.on("error", (err) => {
    const now = Date.now();
    if (err.message !== lastError || now - lastErrorAt > LOG_THROTTLE_MS) {
      console.error("[Redis:cache] error:", err.message);
      lastError = err.message;
      lastErrorAt = now;
    }
  });
  client.on("connect", () => {
    lastError = "";
    lastErrorAt = 0;
  });

  return client;
}

// Only create the real client when Redis is enabled. When disabled, all
// helpers short-circuit before touching this variable.
const cacheClient: IORedis | null = REDIS_ENABLED
  ? (globalThis._redisCache ?? createCacheClient())
  : null;

if (process.env.NODE_ENV !== "production" && cacheClient) {
  globalThis._redisCache = cacheClient;
}

/**
 * Cache wrapper. On cache miss, calls `fetcher`, stores the result with the
 * given TTL, and returns it. On any Redis error, falls through to `fetcher`
 * so the app stays up even when cache is down.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  if (!cacheClient) return fetcher();

  try {
    const hit = await cacheClient.get(key);
    if (hit !== null) {
      return JSON.parse(hit) as T;
    }
  } catch {
    // Cache read failed — fall through and fetch fresh
  }

  const value = await fetcher();

  // Best-effort write — never block the caller on cache failure
  cacheClient
    .set(key, JSON.stringify(value), "EX", ttlSeconds)
    .catch(() => { /* ignore */ });

  return value;
}

/** Invalidate a single key. */
export async function invalidate(key: string): Promise<void> {
  if (!cacheClient) return;
  try {
    await cacheClient.del(key);
  } catch { /* ignore */ }
}

/**
 * Invalidate every key matching a glob pattern (e.g. "parent:overview:*").
 * Uses SCAN — safe to run against large databases.
 */
export async function invalidatePattern(pattern: string): Promise<number> {
  if (!cacheClient) return 0;
  let total = 0;
  try {
    const stream = cacheClient.scanStream({ match: pattern, count: 100 });
    for await (const keys of stream as AsyncIterable<string[]>) {
      if (keys.length > 0) {
        await cacheClient.unlink(...keys);
        total += keys.length;
      }
    }
  } catch (err) {
    console.warn("[cache] invalidatePattern failed:", (err as Error).message);
  }
  return total;
}

/**
 * Set a value without using the wrapper (rare — prefer `cached`).
 */
export async function setRaw(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!cacheClient) return;
  try {
    await cacheClient.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch { /* ignore */ }
}

/**
 * Get a value without using the wrapper.
 */
export async function getRaw<T>(key: string): Promise<T | null> {
  if (!cacheClient) return null;
  try {
    const v = await cacheClient.get(key);
    return v === null ? null : (JSON.parse(v) as T);
  } catch {
    return null;
  }
}
