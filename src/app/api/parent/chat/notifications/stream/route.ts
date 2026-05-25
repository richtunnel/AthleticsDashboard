import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";
import { subscribeChatChannel } from "@/lib/chat/eventBus";
import { REDIS_ENABLED } from "@/lib/redis/enabled";

const POLL_INTERVAL_MS = REDIS_ENABLED ? 60_000 : 5_000;

/**
 * GET /api/parent/chat/notifications/stream?since=<ISO>
 *
 * SSE endpoint for real-time chat notifications (parent side).
 * Fires the header bell when an AD replies across any conversation.
 *
 * Listens on Redis channel user:{parentId} for instant delivery.
 * Also polls DB every 5 s as a safety net.
 */
export async function GET(request: NextRequest) {
  const session = await getParentSession();
  if (!session?.user?.email) return new Response("Unauthorized", { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return new Response("User not found", { status: 404 });

  const sinceParam = request.nextUrl.searchParams.get("since");
  const sinceDate = sinceParam ? new Date(sinceParam) : new Date();

  const encoder = new TextEncoder();
  let lastCheckedAt = sinceDate;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          closed = true;
        }
      };

      send({ type: "connected", userId: user.id });

      // ── Redis subscribe — instant AD-message delivery ─────────────────────
      const unsubscribe = subscribeChatChannel(
        `user:${user.id}`,
        (event) => send(event)
      );

      // ── DB safety-net poll every 5 s ──────────────────────────────────────
      const poll = async () => {
        if (closed) return;
        try {
          const convIds = await prisma.conversation.findMany({
            where: { parentUserId: user.id },
            select: { id: true },
          });
          if (convIds.length === 0) return;

          const messages = await prisma.chatMessage.findMany({
            where: {
              conversationId: { in: convIds.map((c) => c.id) },
              createdAt: { gt: lastCheckedAt },
              senderUserId: { not: user.id },
            },
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
              content: msg.content,
              createdAt: msg.createdAt.toISOString(),
            });
            lastCheckedAt = msg.createdAt;
          }
        } catch { /* retry next tick */ }
      };
      const pollInterval = setInterval(poll, POLL_INTERVAL_MS);

      // Keepalive every 25 s
      const keepaliveInterval = setInterval(() => {
        if (closed) { clearInterval(keepaliveInterval); return; }
        try { controller.enqueue(encoder.encode(": keepalive\n\n")); }
        catch { closed = true; clearInterval(keepaliveInterval); }
      }, 25_000);

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
