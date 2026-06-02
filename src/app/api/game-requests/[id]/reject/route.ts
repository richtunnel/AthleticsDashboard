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
    if (gr.ownerUserId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (gr.status !== "PENDING") return NextResponse.json({ error: "Request is not pending" }, { status: 400 });

    const updated = await prisma.gameRequest.update({
      where: { id },
      data:  { status: "REJECTED", readByOwner: true },
    });

    return NextResponse.json({ request: updated });
  } catch (err) {
    console.error("[game-requests/[id]/reject PUT]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
