/**
 * Single source of truth for whether Redis is enabled in this process.
 *
 * Disabled when:
 *   - REDIS_URL is unset / empty
 *   - REDIS_URL === "disabled" / "false" / "off" / "none"
 *
 * When disabled:
 *   - No Redis clients are created
 *   - No connections are attempted
 *   - No errors are logged
 *   - Chat falls back to in-process EventEmitter only
 *   - Cache becomes a passthrough (always misses, calls fetcher)
 *   - Rate limiting fails open (always allowed)
 *   - BullMQ enqueue throws a clear error
 *
 * To enable locally:
 *   1. Run Redis locally:  docker run -d -p 6379:6379 redis:7-alpine
 *   2. Add to .env.local:  REDIS_URL=redis://localhost:6379
 *
 * To disable locally (no real-time chat, slower dashboards):
 *   Add to .env.local:     REDIS_URL=disabled
 */

const raw = (process.env.REDIS_URL ?? "").trim().toLowerCase();
const DISABLED_VALUES = new Set(["", "disabled", "false", "off", "none", "0"]);

export const REDIS_ENABLED = !DISABLED_VALUES.has(raw);
export const REDIS_URL = process.env.REDIS_URL ?? "";

// Log once at module load so it's obvious what mode you're in
if (typeof process !== "undefined" && process.env.NODE_ENV !== "test") {
  if (!REDIS_ENABLED) {
    // eslint-disable-next-line no-console
    console.warn(
      "[Redis] DISABLED — running without Redis. Chat real-time will use in-process only, " +
        "dashboards won't cache, rate limits will allow all, BullMQ enqueues will fail. " +
        "Set REDIS_URL=redis://localhost:6379 to enable."
    );
  }
}
