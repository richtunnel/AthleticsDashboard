import { NextResponse } from "next/server";
import { getAnySession } from "@/lib/utils/collaboratorSession";
import { prisma } from "@/lib/database/prisma";

export async function GET() {
  const session = await getAnySession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const count = await prisma.gameRequest.count({
      where: {
        ownerUserId: session.user.id,
        readByOwner: false,
        status:      { in: ["PENDING"] },
      },
    });

    // Also count approved requests unread by requester
    const approvedUnread = await prisma.gameRequest.count({
      where: {
        requesterUserId: session.user.id,
        readByRequester: false,
        status:          "APPROVED",
      },
    });

    return NextResponse.json({ count: count + approvedUnread });
  } catch (err) {
    console.error("[game-requests/unread-count GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
