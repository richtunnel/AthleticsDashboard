import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/database/prisma";
import { authOptions } from "@/lib/utils/authOptions";
import { decrypt } from "@/lib/utils/encryption";
import { UserRole } from "@prisma/client";

/**
 * GET /api/chat/conversations
 * Lists all conversations for the AD's organization.
 * Collaborators (ASSISTANT_AD / VENDOR_READ_ONLY) must have APPROVED chat access.
 */
export async function GET() {
  const session = await getServerSession(authOptions);

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

    // Check if the caller is a collaborator and verify their chat access level.
    // Collaborators only see messages when the AD has explicitly APPROVED access.
    if (user.role === UserRole.ASSISTANT_AD || user.role === UserRole.VENDOR_READ_ONLY) {
      const collaboration = await prisma.collaborativeMember.findFirst({
        where: {
          email: user.email.toLowerCase(),
          status: "ACCEPTED",
          revokedAt: null,
        },
        select: { chatAccess: true },
      });

      const hasAccess = collaboration?.chatAccess === "APPROVED";
      if (!hasAccess) {
        // Return 403 so the front-end can show the "Request Access" gate
        return NextResponse.json(
          {
            error: "chat_access_denied",
            chatAccess: collaboration?.chatAccess ?? null,
          },
          { status: 403 }
        );
      }
    }

    // AD sees only conversations with real PARENT-role users.
    // Exclude temporary member/test accounts whose emails match the exact pattern
    // "member-{sessionId}@opletics.com" (vip.opletics.com product-testing flow).
    // Any user whose email only ends with @opletics.com but does NOT start with
    // "member-" is a legitimate parent and is NOT affected by this filter.
    const conversations = await prisma.conversation.findMany({
      where: {
        schoolId: user.organizationId,
        parent: {
          role: UserRole.PARENT,
          NOT: { email: { startsWith: "member-", endsWith: "@opletics.com" } },
        },
      },
      include: {
        parent: {
          select: { id: true, name: true, email: true, image: true },
        },
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

    // Get unread counts in a single aggregated query instead of N individual counts
    const unreadCounts = await prisma.chatMessage.groupBy({
      by: ["conversationId"],
      where: {
        conversationId: { in: conversations.map((c) => c.id) },
        senderUserId: { not: user.id },
        readAt: null,
      },
      _count: { id: true },
    });
    const unreadMap = new Map(unreadCounts.map((u) => [u.conversationId, u._count.id]));

    // Get parent athlete link info for each conversation
    const parentLinks = await prisma.parentAthleteLink.findMany({
      where: {
        schoolId: user.organizationId,
        parentUserId: { in: conversations.map((c) => c.parentUserId) },
      },
      select: {
        parentUserId: true,
        athleteName: true,
        sport: true,
        gradeLevel: true,
      },
    });
    const linkByParent = new Map(parentLinks.map((l) => [l.parentUserId, l]));

    const result = conversations.map((conv) => {
      const lastMessage = conv.messages[0] || null;
      const link = linkByParent.get(conv.parentUserId);

      return {
        id: conv.id,
        schoolId: conv.schoolId,
        schoolName: conv.school.name,
        parentName: conv.parent.name || conv.parent.email,
        parentImage: conv.parent.image || null,
        parentId: conv.parent.id,
        athleteName: link?.athleteName || null,
        sport: link?.sport || null,
        gradeLevel: link?.gradeLevel || null,
        lastMessage: lastMessage
          ? {
              content: decrypt(lastMessage.content),
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
    console.error("[API] Error fetching AD conversations:", error);
    return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
  }
}
