import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";

/**
 * GET /api/parent/chat/conversations
 * Lists all conversations for the authenticated parent.
 */
export async function GET() {
  const session = await getParentSession();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const conversations = await prisma.conversation.findMany({
      where: { parentUserId: user.id },
      include: {
        school: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            content: true,
            createdAt: true,
            senderUserId: true,
          },
        },
      },
      orderBy: { lastMessageAt: { sort: "desc", nulls: "last" } },
    });

    // Get ADs for each school
    const schoolIds = [...new Set(conversations.map((c) => c.schoolId))];
    const ads = await prisma.user.findMany({
      where: {
        organizationId: { in: schoolIds },
        role: "ATHLETIC_DIRECTOR",
      },
      select: { id: true, name: true, image: true, organizationId: true },
    });
    const adBySchool = new Map(ads.map((ad) => [ad.organizationId, ad]));

    // Get unread counts
    const unreadCounts = await Promise.all(
      conversations.map(async (conv) => {
        const count = await prisma.chatMessage.count({
          where: {
            conversationId: conv.id,
            senderUserId: { not: user.id },
            readAt: null,
          },
        });
        return { conversationId: conv.id, count };
      })
    );
    const unreadMap = new Map(unreadCounts.map((u) => [u.conversationId, u.count]));

    const result = conversations.map((conv) => {
      const ad = adBySchool.get(conv.schoolId);
      const lastMessage = conv.messages[0] || null;

      return {
        id: conv.id,
        schoolId: conv.schoolId,
        schoolName: conv.school.name,
        adName: ad?.name || "Athletic Director",
        adImage: ad?.image || null,
        adId: ad?.id || null,
        lastMessage: lastMessage
          ? {
              content: lastMessage.content,
              createdAt: lastMessage.createdAt.toISOString(),
              isFromMe: lastMessage.senderUserId === user.id,
            }
          : null,
        unreadCount: unreadMap.get(conv.id) || 0,
        createdAt: conv.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ conversations: result });
  } catch (error) {
    console.error("[API] Error fetching parent conversations:", error);
    return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
  }
}

/**
 * POST /api/parent/chat/conversations
 * Find-or-create a conversation for the parent + school pair.
 * Body: { schoolId: string }
 */
export async function POST(request: NextRequest) {
  const session = await getParentSession();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { schoolId } = body;

    if (!schoolId || typeof schoolId !== "string") {
      return NextResponse.json({ error: "School ID is required" }, { status: 400 });
    }

    // Verify the parent is linked to this school
    const link = await prisma.parentAthleteLink.findFirst({
      where: { parentUserId: user.id, schoolId },
    });

    if (!link) {
      return NextResponse.json({ error: "You are not linked to this school" }, { status: 403 });
    }

    // Find or create the conversation
    const conversation = await prisma.conversation.upsert({
      where: {
        parentUserId_schoolId: {
          parentUserId: user.id,
          schoolId,
        },
      },
      create: {
        parentUserId: user.id,
        schoolId,
      },
      update: {},
      include: {
        school: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      id: conversation.id,
      schoolId: conversation.schoolId,
      schoolName: conversation.school.name,
    });
  } catch (error) {
    console.error("[API] Error creating conversation:", error);
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  }
}
