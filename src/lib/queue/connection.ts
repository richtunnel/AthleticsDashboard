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

const REDIS_URL = RESOLVED_URL || "redis://localhost:6379";

export const bullConnectionOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => Math.min(times * 500, 10_000),
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
  globalThis._bullConnection ?? (REDIS_ENABLED ? createBullConnection() : createBullConnection());
// Note: we always construct the ioredis client because BullMQ Queue/Worker
// constructors require it. With `lazyConnect: true` no actual TCP attempt
// happens until a command is run, and when Redis is disabled the queue
// service layer refuses to enqueue (see queues.ts `assertEnabled`).

if (process.env.NODE_ENV !== "production") {
  globalThis._bullConnection = bullConnection;
}
