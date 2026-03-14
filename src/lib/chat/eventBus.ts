import { EventEmitter } from "events";

/**
 * Singleton EventEmitter for real-time chat message broadcasting.
 *
 * On a persistent server (Digital Ocean), all API route handlers share
 * the same Node.js process, so this in-memory bus works across requests.
 *
 * Usage:
 *   chatEventBus.emit(`conversation:${id}`, messagePayload)   // POST handler
 *   chatEventBus.on(`conversation:${id}`, callback)            // SSE handler
 *
 * If scaling to multiple instances, swap this for Redis Pub/Sub.
 */

// Use globalThis to survive HMR in development
const globalForChat = globalThis as unknown as {
  chatEventBus: EventEmitter | undefined;
};

export const chatEventBus =
  globalForChat.chatEventBus ?? new EventEmitter();

// Allow many concurrent SSE listeners per conversation
chatEventBus.setMaxListeners(0);

if (process.env.NODE_ENV !== "production") {
  globalForChat.chatEventBus = chatEventBus;
}

export interface ChatMessageEvent {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderName: string;
  content: string;
  createdAt: string;
}
