import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

type Params = { params: Promise<{ id: string }> };

/**
 * DELETE /api/ad-chat/messages/[id]
 * Soft-deletes a message (only the sender may delete their own message).
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getAnySession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = session.user.id;
  const { id } = await params;

  try {
    const msg = await prisma.adMessage.findUnique({
      where: { id },
      select: { senderUserId: true, deletedAt: true },
    });
    if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (msg.senderUserId !== me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (msg.deletedAt) return NextResponse.json({ success: true }); // already deleted

    await prisma.adMessage.update({
      where: { id },
      data:  { deletedAt: new Date() },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[ad-chat/messages DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
