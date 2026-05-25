import IORedis, { type RedisOptions } from "ioredis";
import { REDIS_ENABLED, REDIS_URL as RESOLVED_URL } from "../redis/enabled";

export { REDIS_ENABLED };

/**
 * Dedicated Redis connection for BullMQ.
 *
 * BullMQ requires specific options:
 *   - maxRetriesPerRequest must be null  (blocking commands like BRPOPLPUSH)
 *   - enableReadyCheck   should be false (avoids issues with command queuing)
 *
 * We keep this separate from the chat pub/sub connection because BullMQ
 * holds long-lived blocking connections that should not be shared with
 * the chat publisher/subscriber.
 */

declare global {
  // eslint-disable-next-line no-var
  var _bullConnection: IORedis | undefined;
}

// When Redis is disabled (REDIS_URL unset / "disabled" / "false") we still
// create an IORedis instance because BullMQ Queue constructors require one,
// but we point it at a non-routable address and stop retrying immediately so
// it never generates ECONNREFUSED noise during `next build` or local dev
// without Redis.
const REDIS_URL = REDIS_ENABLED
  ? (RESOLVED_URL || "redis://localhost:6379")
  : "redis://127.0.0.2:6379"; // non-routable — will fail-fast without retrying

export const bullConnectionOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: REDIS_ENABLED
    ? (times) => Math.min(times * 500, 10_000)
    : () => null, // stop retrying immediately when Redis is disabled
  // Don't open a TCP connection until the first command is issued.
  // Prevents Redis errors from spamming the console when modules importing
  // queues.ts are loaded on pages that never enqueue a job.
  lazyConnect: true,
};

const LOG_THROTTLE_MS = 60_000;

function createBullConnection(): IORedis {
  const conn = new IORedis(REDIS_URL, bullConnectionOptions);

  let lastErrorAt = 0;
  let lastErrorMsg = "";
  conn.on("error", (err) => {
    const now = Date.now();
    if (err.message !== lastErrorMsg || now - lastErrorAt > LOG_THROTTLE_MS) {
      console.error("[BullMQ:redis] error:", err.message);
      lastErrorMsg = err.message;
      lastErrorAt = now;
    }
  });
  conn.on("connect", () => {
    lastErrorMsg = "";
    lastErrorAt = 0;
    console.log("[BullMQ:redis] connected");
  });

  return conn;
}

export const bullConnection: IORedis =
  globalThis._bullConnection ?? createBullConnection();
// BullMQ Queue/Worker constructors require an IORedis instance — we always
// create one. With `lazyConnect: true` no TCP attempt happens until a command
// is issued. When Redis is disabled, retryStrategy returns null so any
// accidental command fails immediately without flooding logs with retries.

if (process.env.NODE_ENV !== "production") {
  globalThis._bullConnection = bullConnection;
}
