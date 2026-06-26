import { NextRequest, NextResponse } from "next/server";
import { getAnySession } from "@/lib/utils/collaboratorSession";
import { prisma } from "@/lib/database/prisma";
import { gameRequestConfirmQueue } from "@/lib/queue/queues";

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
    if (gr.requesterUserId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (gr.status !== "APPROVED") return NextResponse.json({ error: "Request is not approved" }, { status: 400 });

    const updated = await prisma.gameRequest.update({
      where: { id },
      data:  { status: "CONFIRMED", confirmedByRequester: true, readByRequester: true },
    });

    await gameRequestConfirmQueue.add("confirm", { gameRequestId: id });

    return NextResponse.json({ request: updated });
  } catch (err) {
    console.error("[game-requests/[id]/confirm PUT]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
