import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { decrypt } from "@/lib/utils/encryption";

/** Sort two user IDs to get a canonical [userAId, userBId] pair. */
function sortPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Returns the status as seen by the requesting user. Blocked parties see DO_NOT_DISTURB. */
function viewerStatus(
  status: string,
  blockedByUserId: string | null,
  viewerId: string,
): "PENDING" | "ACTIVE" | "BLOCKED" | "DO_NOT_DISTURB" {
  if (status === "BLOCKED") {
    return blockedByUserId === viewerId ? "BLOCKED" : "DO_NOT_DISTURB";
  }
  return status as "PENDING" | "ACTIVE";
}

/**
 * GET /api/ad-chat/conversations
 * Lists all AD chat conversations for the current user.
 */
export async function GET() {
  const session = await getAnySession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = session.user.id;

  try {
    const convos = await prisma.adConversation.findMany({
      where: { OR: [{ userAId: me }, { userBId: me }] },
      include: {
        userA: { select: { id: true, name: true, email: true, image: true, schoolName: true } },
        userB: { select: { id: true, name: true, email: true, image: true, schoolName: true } },
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true, createdAt: true, senderUserId: true },
        },
      },
      orderBy: { lastMessageAt: { sort: "desc", nulls: "last" } },
    });

    // Unread counts
    const unread = await prisma.adMessage.groupBy({
      by: ["conversationId"],
      where: {
        conversationId: { in: convos.map((c) => c.id) },
        senderUserId:   { not: me },
        readAt:         null,
        deletedAt:      null,
      },
      _count: { id: true },
    });
    const unreadMap = new Map(unread.map((u) => [u.conversationId, u._count.id]));

    const result = convos.map((c) => {
      const other     = c.userAId === me ? c.userB : c.userA;
      const lastMsg   = c.messages[0] ?? null;
      const convStatus = viewerStatus(c.status, c.blockedByUserId, me);
      return {
        id:           c.id,
        otherUser:    other,
        initiatorId:  c.initiatorId,
        status:       convStatus,
        lastMessage:  lastMsg
          ? {
              content:   decrypt(lastMsg.content),
              createdAt: lastMsg.createdAt.toISOString(),
              isFromMe:  lastMsg.senderUserId === me,
            }
          : null,
        unreadCount: unreadMap.get(c.id) ?? 0,
        createdAt:   c.createdAt.toISOString(),
        updatedAt:   c.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({ conversations: result });
  } catch (err) {
    console.error("[ad-chat/conversations GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/ad-chat/conversations
 * Find or create a conversation between the current user and another AD.
 * Body: { targetUserId: string }
 */
export async function POST(request: NextRequest) {
  const session = await getAnySession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = session.user.id;

  try {
    const { targetUserId } = await request.json();
    if (!targetUserId || typeof targetUserId !== "string") {
      return NextResponse.json({ error: "targetUserId required" }, { status: 400 });
    }
    if (targetUserId === me) {
      return NextResponse.json({ error: "Cannot chat with yourself" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, email: true, image: true, schoolName: true, isDisabled: true },
    });
    if (!target || target.isDisabled) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const [userAId, userBId] = sortPair(me, targetUserId);

    const convo = await prisma.adConversation.upsert({
      where:  { userAId_userBId: { userAId, userBId } },
      update: {},
      create: { userAId, userBId, initiatorId: me },
      include: {
        userA: { select: { id: true, name: true, email: true, image: true, schoolName: true } },
        userB: { select: { id: true, name: true, email: true, image: true, schoolName: true } },
      },
    });

    const other      = convo.userAId === me ? convo.userB : convo.userA;
    const convStatus = viewerStatus(convo.status, convo.blockedByUserId, me);

    return NextResponse.json({
      conversation: {
        id:          convo.id,
        otherUser:   other,
        initiatorId: convo.initiatorId,
        status:      convStatus,
        lastMessage: null,
        unreadCount: 0,
        createdAt:   convo.createdAt.toISOString(),
        updatedAt:   convo.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[ad-chat/conversations POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
