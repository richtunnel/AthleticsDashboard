import Redis from "ioredis";
import { REDIS_ENABLED, REDIS_URL as RESOLVED_URL } from "../redis/enabled";

/**
 * Singleton Redis clients for chat pub/sub.
 *
 * Two separate connections are required:
 *   - publisher  → used for PUBLISH commands (stays in normal mode)
 *   - subscriber → used for SUBSCRIBE commands (enters subscribe-only mode)
 *
 * Both use globalThis to survive Next.js HMR in development without creating
 * a new connection on every hot reload.
 *
 * Log throttling: repeated reconnect/error messages are suppressed after the
 * first occurrence so production logs stay readable.
 */

declare global {
  // eslint-disable-next-line no-var
  var _redisPub: Redis | undefined;
  // eslint-disable-next-line no-var
  var _redisSub: Redis | undefined;
}

const REDIS_URL = RESOLVED_URL || "redis://localhost:6379";

const LOG_THROTTLE_MS = 60_000;

/**
 * No-op stub used when Redis is disabled. Every method the codebase calls
 * (`publish`, `subscribe`, `unsubscribe`, `on`, …) returns harmlessly.
 */
function createStub(name: string): Redis {
  const stub: any = {
    publish: async () => 0,
    subscribe: async () => undefined,
    unsubscribe: async () => undefined,
    on: () => stub,
    off: () => stub,
    quit: async () => "OK",
    disconnect: () => undefined,
    status: "end",
  };
  console.log(`[Redis:${name}] stub (Redis disabled)`);
  return stub as Redis;
}

function createClient(name: string): Redis {
  if (!REDIS_ENABLED) return createStub(name);

  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy: (times) => Math.min(times * 500, 10_000),
    enableReadyCheck: true,
    // Defer the TCP connect until the first command is issued. This stops
    // the publisher/subscriber from spamming "ENOTFOUND" on every page load
    // when Redis isn't running locally.
    lazyConnect: true,
    showFriendlyErrorStack: false,
  });

  let lastErrorMsg = "";
  let lastErrorAt = 0;

  client.on("connect", () => {
    lastErrorMsg = "";
    lastErrorAt = 0;
    console.log(`[Redis:${name}] connected`);
  });

  client.on("error", (err: Error) => {
    const now = Date.now();
    // Log at most once per minute for the same error, plus once for any new error
    if (err.message !== lastErrorMsg || now - lastErrorAt > LOG_THROTTLE_MS) {
      console.error(`[Redis:${name}] error:`, err.message);
      lastErrorMsg = err.message;
      lastErrorAt = now;
    }
  });

  // Reconnecting fires constantly during an outage — suppress entirely
  client.on("reconnecting", () => { /* silent */ });

  return client;
}

export const redisPublisher: Redis =
  globalThis._redisPub ?? createClient("pub");

export const redisSubscriber: Redis =
  globalThis._redisSub ?? createClient("sub");

if (process.env.NODE_ENV !== "production") {
  globalThis._redisPub = redisPublisher;
  globalThis._redisSub = redisSubscriber;
}
