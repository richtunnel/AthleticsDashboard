import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { chatEventBus, ChatMessageEvent } from "@/lib/chat/eventBus";

/**
 * GET /api/chat/notifications/stream
 *
 * Server-Sent Events endpoint for real-time chat notifications (AD side).
 * Listens on school-level events so ADs get notified of all incoming
 * parent messages across all conversations for their organization.
 */
export async function GET(request: NextRequest) {
  const session = await getAnySession();

  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, organizationId: true },
  });

  if (!user || !user.organizationId) {
    return new Response("User not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection confirmation with userId for client-side filtering
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected", userId: user.id })}\n\n`)
      );

      // Listen for parent messages to this school/org
      const eventName = `school:${user.organizationId}`;
      const onMessage = (message: ChatMessageEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(message)}\n\n`)
          );
        } catch {
          chatEventBus.off(eventName, onMessage);
        }
      };

      chatEventBus.on(eventName, onMessage);

      // Keepalive ping every 30 seconds
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepalive);
          chatEventBus.off(eventName, onMessage);
        }
      }, 30_000);

      // Clean up when the client disconnects
      request.signal.addEventListener("abort", () => {
        clearInterval(keepalive);
        chatEventBus.off(eventName, onMessage);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
