import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { encrypt, decrypt } from "@/lib/utils/encryption";
import { publishChatEvent } from "@/lib/chat/eventBus";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/ad-chat/conversations/[id]/messages
 * Returns decrypted messages (excluding soft-deleted), marks unread as read.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getAnySession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = session.user.id;
  const { id } = await params;

  try {
    const convo = await prisma.adConversation.findUnique({
      where: { id },
      select: { id: true, userAId: true, userBId: true, status: true, blockedByUserId: true },
    });
    if (!convo || (convo.userAId !== me && convo.userBId !== me)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const messages = await prisma.adMessage.findMany({
      where:   { conversationId: id, deletedAt: null },
      include: { sender: { select: { name: true, email: true, image: true } } },
      orderBy: { createdAt: "asc" },
      take:    200,
    });

    // Mark unread messages from the other party as read
    const unreadIds = messages
      .filter((m) => m.senderUserId !== me && !m.readAt)
      .map((m) => m.id);
    if (unreadIds.length > 0) {
      await prisma.adMessage.updateMany({
        where: { id: { in: unreadIds } },
        data:  { readAt: new Date() },
      });
    }

    return NextResponse.json({
      messages: messages.map((m) => ({
        id:            m.id,
        conversationId: m.conversationId,
        senderUserId:  m.senderUserId,
        senderName:    m.sender.name || m.sender.email || "Unknown",
        senderImage:   m.sender.image ?? null,
        content:       decrypt(m.content),
        readAt:        m.readAt?.toISOString() ?? null,
        createdAt:     m.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[ad-chat/messages GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/ad-chat/conversations/[id]/messages
 * Send a message. Validates PENDING/BLOCKED rules.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getAnySession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = session.user.id;
  const { id } = await params;

  try {
    const { content } = await request.json();
    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Content required" }, { status: 400 });
    }
    if (content.length > 5000) {
      return NextResponse.json({ error: "Message too long" }, { status: 400 });
    }

    const convo = await prisma.adConversation.findUnique({
      where: { id },
      select: { id: true, userAId: true, userBId: true, status: true, blockedByUserId: true, initiatorId: true },
    });
    if (!convo || (convo.userAId !== me && convo.userBId !== me)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // ── Blocking rules ──────────────────────────────────────────────────────
    if (convo.status === "BLOCKED") {
      if (convo.blockedByUserId !== me) {
        // I am the blocked party — silent DND response
        return NextResponse.json({ error: "do_not_disturb" }, { status: 403 });
      }
      // I am the blocker — also can't send (conversation is muted)
      return NextResponse.json({ error: "You have muted this conversation" }, { status: 403 });
    }

    // ── Pending rules ────────────────────────────────────────────────────────
    if (convo.status === "PENDING") {
      if (convo.initiatorId === me) {
        // Already sent the first message; wait for a reply
        return NextResponse.json({ error: "awaiting_reply" }, { status: 403 });
      }
      // Recipient is replying — activate the conversation
      await prisma.adConversation.update({
        where: { id },
        data:  { status: "ACTIVE" },
      });
    }

    const recipient = convo.userAId === me ? convo.userBId : convo.userAId;

    // Create message + update lastMessageAt in a transaction
    const [msg] = await prisma.$transaction([
      prisma.adMessage.create({
        data: {
          conversationId: id,
          senderUserId:   me,
          content:        encrypt(content.trim()),
        },
        include: { sender: { select: { name: true, email: true, image: true } } },
      }),
      prisma.adConversation.update({
        where: { id },
        data:  { lastMessageAt: new Date() },
      }),
    ]);

    const payload = {
      id:             msg.id,
      conversationId: id,
      senderUserId:   me,
      senderName:     msg.sender.name || msg.sender.email || "Unknown",
      senderImage:    msg.sender.image ?? null,
      content:        content.trim(),
      readAt:         null,
      createdAt:      msg.createdAt.toISOString(),
    };

    // Push to conversation channel (for open SSE listeners)
    publishChatEvent(`ad-conversation:${id}`, payload);
    // Push to recipient's user channel (for notification stream)
    publishChatEvent(`ad-user:${recipient}`, {
      ...payload,
      type: "ad_message",
    });

    return NextResponse.json({ message: payload }, { status: 201 });
  } catch (err) {
    console.error("[ad-chat/messages POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
