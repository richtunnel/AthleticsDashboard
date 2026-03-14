import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";

/**
 * POST /api/parent/chat/conversations/[conversationId]/read
 * Marks all unread messages in a conversation as read (parent side).
 * Only marks messages sent by others (not the parent's own messages).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const session = await getParentSession();
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

    // Verify parent owns this conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { parentUserId: true },
    });

    if (!conversation || conversation.parentUserId !== user.id) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Mark all messages from the other party as read
    const result = await prisma.chatMessage.updateMany({
      where: {
        conversationId,
        senderUserId: { not: user.id },
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ success: true, markedRead: result.count });
  } catch (error) {
    console.error("[API] Error marking messages as read:", error);
    return NextResponse.json({ error: "Failed to mark messages as read" }, { status: 500 });
  }
}
