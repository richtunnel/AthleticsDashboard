import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/ad-chat/conversations/[id]/block
 * Body: { action: "block" | "unblock" }
 * Block silently mutes the conversation; blocked party sees "do not disturb" copy.
 * Unblock restores ACTIVE status — only the blocker can unblock.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getAnySession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = session.user.id;
  const { id } = await params;

  try {
    const { action } = await request.json() as { action: "block" | "unblock" };
    if (action !== "block" && action !== "unblock") {
      return NextResponse.json({ error: "action must be block or unblock" }, { status: 400 });
    }

    const convo = await prisma.adConversation.findUnique({
      where: { id },
      select: { userAId: true, userBId: true, status: true, blockedByUserId: true },
    });
    if (!convo || (convo.userAId !== me && convo.userBId !== me)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (action === "block") {
      await prisma.adConversation.update({
        where: { id },
        data:  { status: "BLOCKED", blockedByUserId: me },
      });
      return NextResponse.json({ status: "BLOCKED" });
    }

    // Unblock — only the blocker may unblock
    if (convo.blockedByUserId !== me) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await prisma.adConversation.update({
      where: { id },
      data:  { status: "ACTIVE", blockedByUserId: null },
    });
    return NextResponse.json({ status: "ACTIVE" });
  } catch (err) {
    console.error("[ad-chat/block]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
