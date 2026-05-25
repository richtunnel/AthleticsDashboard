import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { publishChatEvent, ChatMessageEvent } from "@/lib/chat/eventBus";
import { encrypt, decrypt } from "@/lib/utils/encryption";

/**
 * GET /api/chat/conversations/[conversationId]/messages
 * Fetch paginated messages for a conversation (AD side).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const session = await getAnySession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { conversationId } = await params;

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify AD's org matches the conversation's school
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { schoolId: true },
    });

    if (!conversation || conversation.schoolId !== user.organizationId) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const cursor = request.nextUrl.searchParams.get("cursor");
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get("limit") || "50", 10),
      100
    );

    const messages = await prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: limit,
      ...(cursor
        ? {
            skip: 1,
            cursor: { id: cursor },
          }
        : {}),
      include: {
        sender: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    return NextResponse.json({
      messages: messages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        senderUserId: m.senderUserId,
        senderName: m.sender.name || "Unknown",
        senderImage: m.sender.image || null,
        content: decrypt(m.content),
        readAt: m.readAt?.toISOString() || null,
        createdAt: m.createdAt.toISOString(),
      })),
      nextCursor: messages.length === limit ? messages[messages.length - 1].id : null,
    });
  } catch (error) {
    console.error("[API] Error fetching messages:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

/**
 * POST /api/chat/conversations/[conversationId]/messages
 * Send a new message (AD side).
 * Body: { content: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const session = await getAnySession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { conversationId } = await params;

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify AD's org matches the conversation's school
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { schoolId: true, parentUserId: true },
    });

    if (!conversation || conversation.schoolId !== user.organizationId) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const body = await request.json();
    const content = body.content?.trim();

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 });
    }

    if (content.length > 2000) {
      return NextResponse.json({ error: "Message must be 2000 characters or less" }, { status: 400 });
    }

    // Create the message and update conversation timestamp
    const encryptedContent = encrypt(content);
    const message = await prisma.$transaction(async (tx) => {
      const msg = await tx.chatMessage.create({
        data: {
          conversationId,
          senderUserId: user.id,
          content: encryptedContent,
        },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: msg.createdAt },
      });

      return msg;
    });

    // Emit to SSE listeners
    const event: ChatMessageEvent = {
      id: message.id,
      conversationId,
      senderUserId: user.id,
      senderName: user.name || "Athletic Director",
      content: content,
      createdAt: message.createdAt.toISOString(),
    };

    // Fire-and-forget: publish to Redis (cross-process) + local bus
    // conversation channel → parent's open chat window
    // user channel         → parent's header bell notification
    void publishChatEvent(`conversation:${conversationId}`, event);
    void publishChatEvent(`user:${conversation.parentUserId}`, event);

    return NextResponse.json({
      id: message.id,
      conversationId,
      senderUserId: user.id,
      senderName: user.name || "Athletic Director",
      content: content,
      readAt: null,
      createdAt: message.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("[API] Error sending message:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
