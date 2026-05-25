import { getAnySession } from "@/lib/utils/collaboratorSession";
import { getParentSession } from "@/lib/utils/parentSession";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { decrypt } from "@/lib/utils/encryption";
import { subscribeChatChannel } from "@/lib/chat/eventBus";
import { REDIS_ENABLED } from "@/lib/redis/enabled";

// Poll cadence:
//   - Redis ON  → 60s safety-net (Redis Pub/Sub is the primary delivery path)
//   - Redis OFF → 5s primary delivery (no other way to get new messages)
const POLL_INTERVAL_MS = REDIS_ENABLED ? 60_000 : 5_000;

/**
 * GET /api/chat/stream?conversationId=xxx&since=<ISO>
 *
 * SSE endpoint for real-time chat messages (parents + ADs).
 *
 * Delivery layers — both always active:
 *
 *   1. On connect  — DB catch-up query for messages since `since` param.
 *   2. Real-time   — Redis Pub/Sub via subscribeChatChannel (<50 ms).
 *                    Falls back silently to in-process EventEmitter when
 *                    Redis is unreachable (single-container deployments).
 *   3. Safety net  — DB poll every 5 s catches anything Redis may have
 *                    missed (Redis hiccup, reconnect window, etc.).
 *
 * Deduplication is handled on the client (useChatSSE checks message IDs).
 */
export async function GET(request: NextRequest) {
  const session = (await getAnySession()) ?? (await getParentSession());
  if (!session?.user?.email) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = request.nextUrl;
  const conversationId = searchParams.get("conversationId");
  if (!conversationId) return new Response("Missing conversationId", { status: 400 });

  const sinceParam = searchParams.get("since");
  const sinceDate = sinceParam ? new Date(sinceParam) : new Date();

  // ── Auth ──────────────────────────────────────────────────────────────────
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return new Response("User not found", { status: 404 });

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { parentUserId: true, schoolId: true },
  });
  if (!conversation) return new Response("Conversation not found", { status: 404 });

  const isParent = conversation.parentUserId === user.id;
  const isSchoolStaff = user.organizationId === conversation.schoolId;
  if (!isParent && !isSchoolStaff) return new Response("Forbidden", { status: 403 });

  // ── SSE stream ────────────────────────────────────────────────────────────
  const encoder = new TextEncoder();
  let lastCheckedAt = sinceDate;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // 1. Handshake
      send({ type: "connected" });

      // 2. DB catch-up — deliver messages that arrived before this connection
      try {
        const missed = await prisma.chatMessage.findMany({
          where: { conversationId, createdAt: { gt: sinceDate } },
          include: { sender: { select: { name: true, email: true } } },
          orderBy: { createdAt: "asc" },
          take: 100,
        });
        for (const msg of missed) {
          send({
            id: msg.id,
            conversationId: msg.conversationId,
            senderUserId: msg.senderUserId,
            senderName: msg.sender.name || msg.sender.email || "Unknown",
            content: decrypt(msg.content),
            createdAt: msg.createdAt.toISOString(),
            readAt: msg.readAt?.toISOString() ?? null,
          });
          lastCheckedAt = msg.createdAt;
        }
      } catch { /* non-fatal */ }

      // 3. Redis subscribe — instant push when a message is published
      const unsubscribe = subscribeChatChannel(
        `conversation:${conversationId}`,
        (event) => send(event)
      );

      // 4. DB safety-net poll — catches anything Redis may have missed
      //    Client deduplication (by message ID) prevents double-delivery.
      const poll = async () => {
        if (closed) return;
        try {
          const messages = await prisma.chatMessage.findMany({
            where: { conversationId, createdAt: { gt: lastCheckedAt } },
            include: { sender: { select: { name: true, email: true } } },
            orderBy: { createdAt: "asc" },
            take: 50,
          });
          for (const msg of messages) {
            send({
              id: msg.id,
              conversationId: msg.conversationId,
              senderUserId: msg.senderUserId,
              senderName: msg.sender.name || msg.sender.email || "Unknown",
              content: decrypt(msg.content),
              createdAt: msg.createdAt.toISOString(),
              readAt: msg.readAt?.toISOString() ?? null,
            });
            lastCheckedAt = msg.createdAt;
          }
        } catch { /* retry next tick */ }
      };
      const pollInterval = setInterval(poll, POLL_INTERVAL_MS);

      // 5. Keepalive every 25 s — survives proxy timeouts
      const keepaliveInterval = setInterval(() => {
        if (closed) { clearInterval(keepaliveInterval); return; }
        try { controller.enqueue(encoder.encode(": keepalive\n\n")); }
        catch { closed = true; clearInterval(keepaliveInterval); }
      }, 25_000);

      // 6. Cleanup on client disconnect
      request.signal.addEventListener("abort", () => {
        closed = true;
        unsubscribe();
        clearInterval(pollInterval);
        clearInterval(keepaliveInterval);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
