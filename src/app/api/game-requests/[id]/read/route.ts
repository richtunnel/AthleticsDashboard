import { NextRequest, NextResponse } from "next/server";
import { getAnySession } from "@/lib/utils/collaboratorSession";
import { prisma } from "@/lib/database/prisma";

export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAnySession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const gr = await prisma.gameRequest.findUnique({ where: { id } });
    if (!gr) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isOwner     = gr.ownerUserId     === session.user.id;
    const isRequester = gr.requesterUserId === session.user.id;

    if (!isOwner && !isRequester) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await prisma.gameRequest.update({
      where: { id },
      data: {
        ...(isOwner     && { readByOwner:     true }),
        ...(isRequester && { readByRequester: true }),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[game-requests/[id]/read PUT]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
