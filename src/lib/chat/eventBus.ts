import { EventEmitter } from "events";
import { redisPublisher, redisSubscriber } from "./redisClient";

/**
 * Chat event bus — Redis Pub/Sub backed, with in-process EventEmitter routing.
 *
 * Architecture
 * ────────────
 *   POST handler
 *     └─ publishChatEvent(channel, payload)
 *           ├─ emit on localBus   (delivers to SSE listeners in THIS process instantly)
 *           └─ PUBLISH to Redis   (delivers to every other process/container)
 *
 *   Redis subscriber (one global connection)
 *     └─ on 'message' → emit on localBus  (cross-process delivery lands here)
 *
 *   SSE route
 *     └─ subscribeChatChannel(channel, cb)
 *           ├─ listens on localBus
 *           └─ SUBSCRIBEs in Redis (so this process receives cross-process events)
 *
 * Fallback
 * ────────
 * If Redis is unreachable, `publishChatEvent` still emits locally so same-process
 * delivery works. SSE routes fall back to 5-second DB polling automatically.
 */

// ── Local event router ────────────────────────────────────────────────────────
const localBus = new EventEmitter();
localBus.setMaxListeners(0);

// Track which Redis channels this process has subscribed to (for re-subscribe on reconnect)
const redisChannels = new Set<string>();

// ── Wire up the global Redis subscriber ───────────────────────────────────────
// On every (re)connect, re-subscribe to every channel we know about.
// This handles two cases:
//   1. The very first connection (triggered lazily by the first subscribe call)
//   2. Reconnects after a Redis outage
redisSubscriber.on("ready", () => {
  if (redisChannels.size > 0) {
    redisSubscriber.subscribe(...redisChannels).catch(() => {});
  }
});

// Every message from Redis gets routed into the local bus, which then
// fires the SSE callbacks registered via subscribeChatChannel.
redisSubscriber.on("message", (channel: string, raw: string) => {
  try {
    localBus.emit(channel, JSON.parse(raw));
  } catch {
    // Malformed JSON — ignore
  }
});

// ── Public API ────────────────────────────────────────────────────────────────

export interface ChatMessageEvent {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderName: string;
  content: string;      // Always plain-text (never the encrypted DB value)
  createdAt: string;
  readAt?: string | null;
}

export interface SyncRequestEvent {
  type: "sync_request";
  requestId: string;
  parentName: string;
  sportName: string;
  sportLevel: string;
  requestedAt: string;
}

/**
 * Publish an event to all listeners — same process (via localBus) and every
 * other process/container (via Redis Pub/Sub).
 *
 * Fire-and-forget: local delivery is synchronous, Redis publish runs in the
 * background. The POST handler that called us never waits on Redis.
 */
export function publishChatEvent(channel: string, payload: object): void {
  // 1. Same-process delivery — instant, never throws
  localBus.emit(channel, payload);

  // 2. Cross-process delivery via Redis — background, never blocks the caller.
  //    If Redis is disabled the publisher is a stub whose .publish() resolves
  //    to 0 immediately. If Redis is unreachable the promise rejects after
  //    its retry budget, which we swallow (local delivery already succeeded).
  redisPublisher
    .publish(channel, JSON.stringify(payload))
    .catch((err: Error) => {
      // Logged at most once per minute by the client-level throttle
      console.error("[EventBus] Redis publish failed:", err.message);
    });
}

/**
 * Subscribe to a chat channel.
 * Returns a cleanup function — call it when the SSE connection closes.
 *
 * The subscribe call is fire-and-forget: if Redis isn't connected yet,
 * ioredis queues the command and sends it once the connection completes.
 * The "ready" handler above also re-subscribes on every reconnect, so a
 * temporary Redis outage doesn't leave us deaf to future messages.
 */
export function subscribeChatChannel(
  channel: string,
  listener: (payload: any) => void
): () => void {
  localBus.on(channel, listener);

  // Register the channel and ask Redis to forward its messages to us.
  // No `redisReady` gate — ioredis handles the connect race internally.
  if (!redisChannels.has(channel)) {
    redisChannels.add(channel);
    redisSubscriber.subscribe(channel).catch(() => { /* will retry on ready */ });
  }

  return () => {
    localBus.off(channel, listener);

    // Unsubscribe from Redis only when nobody locally is listening anymore
    if (localBus.listenerCount(channel) === 0) {
      redisChannels.delete(channel);
      redisSubscriber.unsubscribe(channel).catch(() => {});
    }
  };
}
