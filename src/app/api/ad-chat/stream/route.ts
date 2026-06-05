import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { decrypt } from "@/lib/utils/encryption";
import { subscribeChatChannel } from "@/lib/chat/eventBus";
import { REDIS_ENABLED } from "@/lib/redis/enabled";

const POLL_INTERVAL_MS = REDIS_ENABLED ? 60_000 : 5_000;

/**
 * GET /api/ad-chat/stream?conversationId=xxx&since=<ISO>
 *
 * SSE stream for real-time AD chat messages in a single conversation.
 * Same architecture as /api/chat/stream — Redis Pub/Sub + DB poll fallback.
 */
export async function GET(request: NextRequest) {
  const session = await getAnySession();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = request.nextUrl;
  const conversationId = searchParams.get("conversationId");
  if (!conversationId) return new Response("Missing conversationId", { status: 400 });

  const sinceParam = searchParams.get("since");
  const sinceDate  = sinceParam ? new Date(sinceParam) : new Date();

  const me = session.user.id;

  const convo = await prisma.adConversation.findUnique({
    where:  { id: conversationId },
    select: { userAId: true, userBId: true },
  });
  if (!convo || (convo.userAId !== me && convo.userBId !== me)) {
    return new Response("Forbidden", { status: 403 });
  }

  const encoder  = new TextEncoder();
  let lastCheckedAt = sinceDate;
  let closed        = false;

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

      send({ type: "connected" });

      // 1. DB catch-up
      try {
        const missed = await prisma.adMessage.findMany({
          where:   { conversationId, createdAt: { gt: sinceDate }, deletedAt: null },
          include: { sender: { select: { name: true, email: true, image: true } } },
          orderBy: { createdAt: "asc" },
          take:    100,
        });
        for (const msg of missed) {
          send({
            id:             msg.id,
            conversationId: msg.conversationId,
            senderUserId:   msg.senderUserId,
            senderName:     msg.sender.name || msg.sender.email || "Unknown",
            senderImage:    msg.sender.image ?? null,
            content:        decrypt(msg.content),
            createdAt:      msg.createdAt.toISOString(),
            readAt:         msg.readAt?.toISOString() ?? null,
          });
          lastCheckedAt = msg.createdAt;
        }
      } catch { /* non-fatal */ }

      // 2. Redis subscribe
      const unsubscribe = subscribeChatChannel(
        `ad-conversation:${conversationId}`,
        (event) => send(event),
      );

      // 3. DB poll safety-net
      const poll = async () => {
        if (closed) return;
        try {
          const messages = await prisma.adMessage.findMany({
            where:   { conversationId, createdAt: { gt: lastCheckedAt }, deletedAt: null },
            include: { sender: { select: { name: true, email: true, image: true } } },
            orderBy: { createdAt: "asc" },
            take:    50,
          });
          for (const msg of messages) {
            send({
              id:             msg.id,
              conversationId: msg.conversationId,
              senderUserId:   msg.senderUserId,
              senderName:     msg.sender.name || msg.sender.email || "Unknown",
              senderImage:    msg.sender.image ?? null,
              content:        decrypt(msg.content),
              createdAt:      msg.createdAt.toISOString(),
              readAt:         msg.readAt?.toISOString() ?? null,
            });
            lastCheckedAt = msg.createdAt;
          }
        } catch { /* retry next tick */ }
      };
      const pollInterval = setInterval(poll, POLL_INTERVAL_MS);

      // 4. Keepalive
      const keepalive = setInterval(() => {
        if (closed) { clearInterval(keepalive); return; }
        try { controller.enqueue(encoder.encode(": keepalive\n\n")); }
        catch { closed = true; clearInterval(keepalive); }
      }, 25_000);

      // 5. Cleanup
      request.signal.addEventListener("abort", () => {
        closed = true;
        unsubscribe();
        clearInterval(pollInterval);
        clearInterval(keepalive);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":    "text/event-stream",
      "Cache-Control":   "no-cache, no-transform",
      "Connection":      "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
