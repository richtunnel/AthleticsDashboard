import { getAnySession } from "@/lib/utils/collaboratorSession";
import { getParentSession } from "@/lib/utils/parentSession";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { chatEventBus, ChatMessageEvent } from "@/lib/chat/eventBus";

/**
 * GET /api/chat/stream?conversationId=xxx
 *
 * Server-Sent Events endpoint for real-time chat messages.
 * Both parents and ADs connect here. Auth verifies the caller
 * owns the conversation (parent by parentUserId, AD by schoolId matching org).
 */
export async function GET(request: NextRequest) {
  // Try AD/collaborator session first, fall back to parent session
  const session = (await getAnySession()) ?? (await getParentSession());

  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const conversationId = request.nextUrl.searchParams.get("conversationId");
  if (!conversationId) {
    return new Response("Missing conversationId", { status: 400 });
  }

  // Look up user and conversation
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return new Response("User not found", { status: 404 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { parentUserId: true, schoolId: true },
  });

  if (!conversation) {
    return new Response("Conversation not found", { status: 404 });
  }

  // Authorize: parent must own the conversation, AD must belong to the school
  const isParent = conversation.parentUserId === user.id;
  const isSchoolStaff = user.organizationId === conversation.schoolId;

  if (!isParent && !isSchoolStaff) {
    return new Response("Forbidden", { status: 403 });
  }

  // Create the SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection confirmation
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`)
      );

      // Listen for new messages on this conversation
      const eventName = `conversation:${conversationId}`;
      const onMessage = (message: ChatMessageEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(message)}\n\n`)
          );
        } catch {
          // Stream was closed, clean up
          chatEventBus.off(eventName, onMessage);
        }
      };

      chatEventBus.on(eventName, onMessage);

      // Keepalive ping every 30 seconds to prevent proxy/load-balancer timeouts
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
      "X-Accel-Buffering": "no", // Disable Nginx buffering
    },
  });
}
