import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

/**
 * GET /api/ad-chat/unread
 * Returns the total number of unread AD chat messages for the current user.
 */
export async function GET() {
  const session = await getAnySession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = session.user.id;

  try {
    const count = await prisma.adMessage.count({
      where: {
        senderUserId: { not: me },
        readAt:       null,
        deletedAt:    null,
        conversation: { OR: [{ userAId: me }, { userBId: me }] },
      },
    });
    return NextResponse.json({ count });
  } catch (err) {
    console.error("[ad-chat/unread]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
