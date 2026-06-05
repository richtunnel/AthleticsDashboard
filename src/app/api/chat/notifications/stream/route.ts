import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { subscribeChatChannel } from "@/lib/chat/eventBus";
import { REDIS_ENABLED } from "@/lib/redis/enabled";

// Slow safety-net poll when Redis is delivering events in real-time.
// When Redis is off, poll fast since it's the only delivery path.
const POLL_INTERVAL_MS = REDIS_ENABLED ? 60_000 : 5_000;

/**
 * GET /api/chat/notifications/stream?since=<ISO>
 *
 * SSE endpoint for real-time AD notifications.
 *
 * Listens on:
 *   • Redis channel school:{orgId} — new parent messages
 *   • Redis channel sync:{orgId}   — new calendar sync requests
 *
 * Also polls DB every 5 s as a safety net in case Redis misses an event.
 */
export async function GET(request: NextRequest) {
  const session = await getAnySession();
  if (!session?.user?.email) return new Response("Unauthorized", { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, organizationId: true },
  });
  if (!user?.organizationId) return new Response("User not found or no organization", { status: 404 });

  const sinceParam = request.nextUrl.searchParams.get("since");
  const sinceDate = sinceParam ? new Date(sinceParam) : new Date();

  const encoder = new TextEncoder();
  let lastMessageAt     = sinceDate;
  let lastSyncAt        = sinceDate;
  let lastGameRequestAt = sinceDate;
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

      // ── Redis subscribe — both channels, always active ───────────────────
      const unsubs = [
        subscribeChatChannel(`school:${user.organizationId}`, (event) => {
          if (event.senderUserId === user.id) return;
          send({ type: "new_message", ...event });
        }),
        subscribeChatChannel(`sync:${user.organizationId}`, (event) => {
          send({ type: "sync_request", ...event });
        }),
        // AD-to-AD chat notifications for this specific user
        subscribeChatChannel(`ad-user:${user.id}`, (event) => {
          if (event.senderUserId === user.id) return;
          send({ type: "ad_message", ...event });
        }),
      ];

      // ── DB safety-net poll every 5 s ─────────────────────────────────────
      const poll = async () => {
        if (closed) return;

        try {
          const messages = await prisma.chatMessage.findMany({
            where: {
              createdAt: { gt: lastMessageAt },
              conversation: { schoolId: user.organizationId! },
              senderUserId: { not: user.id },
            },
            include: { sender: { select: { name: true, email: true } } },
            orderBy: { createdAt: "asc" },
            take: 50,
          });
          for (const msg of messages) {
            send({
              type: "new_message",
              id: msg.id,
              conversationId: msg.conversationId,
              senderUserId: msg.senderUserId,
              senderName: msg.sender.name || msg.sender.email || "Unknown",
              content: msg.content,
              createdAt: msg.createdAt.toISOString(),
            });
            lastMessageAt = msg.createdAt;
          }
        } catch { /* retry next tick */ }

        // ── Game Request events ──────────────────────────────────────────────
        try {
          const gameRequests = await prisma.gameRequest.findMany({
            where: {
              OR: [{ ownerUserId: user.id }, { requesterUserId: user.id }],
              updatedAt: { gt: lastGameRequestAt },
            },
            select: {
              id:        true,
              ownerUserId: true,
              requesterUserId: true,
              status:    true,
              updatedAt: true,
              readByOwner: true,
              readByRequester: true,
            },
            orderBy: { updatedAt: "asc" },
            take: 20,
          });

          for (const gr of gameRequests) {
            const isOwner     = gr.ownerUserId     === user.id;
            const isRequester = gr.requesterUserId === user.id;

            let type: string | null = null;
            if (gr.status === "PENDING"   && isOwner     && !gr.readByOwner)     type = "GAME_REQUEST_RECEIVED";
            if (gr.status === "APPROVED"  && isRequester && !gr.readByRequester) type = "GAME_REQUEST_APPROVED";
            if (gr.status === "REJECTED"  && isRequester)                        type = "GAME_REQUEST_REJECTED";
            if (gr.status === "CONFIRMED" && isOwner)                            type = "GAME_REQUEST_CONFIRMED";

            if (type) {
              send({ type, requestId: gr.id });
            }
            lastGameRequestAt = gr.updatedAt;
          }

          // Also emit unread count for badge refresh
          if (gameRequests.length > 0) {
            const unreadOwner = await prisma.gameRequest.count({
              where: { ownerUserId: user.id, readByOwner: false, status: "PENDING" },
            });
            const unreadReq = await prisma.gameRequest.count({
              where: { requesterUserId: user.id, readByRequester: false, status: "APPROVED" },
            });
            send({ type: "GAME_REQUEST_COUNT_UPDATE", count: unreadOwner + unreadReq });
          }
        } catch { /* retry next tick */ }

        try {
          const reqs = await prisma.calendarSyncRequest.findMany({
            where: {
              schoolId: user.organizationId!,
              status: "PENDING",
              requestedAt: { gt: lastSyncAt },
            },
            include: { parent: { select: { name: true, email: true } } },
            orderBy: { requestedAt: "asc" },
            take: 20,
          });
          for (const req of reqs) {
            send({
              type: "sync_request",
              requestId: req.id,
              parentName: req.parent.name || req.parent.email || "A parent",
              sportName: req.sportName,
              sportLevel: req.sportLevel,
              requestedAt: req.requestedAt.toISOString(),
            });
            lastSyncAt = req.requestedAt;
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
        unsubs.forEach((fn) => fn());
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
