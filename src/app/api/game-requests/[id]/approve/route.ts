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

    const dateKey = gr.availableDate.toISOString().slice(0, 10);

    // Atomically approve + lock the date so no other AD can claim it
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.gameRequest.update({
        where: { id },
        data: { status: "APPROVED", confirmedByOwner: true, readByOwner: true },
      });

      const post = await tx.schedulePost.findUnique({
        where:  { id: gr.schedulePostId },
        select: { excludedDates: true },
      });
      const current = (post?.excludedDates as string[]) ?? [];
      if (!current.includes(dateKey)) {
        await tx.schedulePost.update({
          where: { id: gr.schedulePostId },
          data:  { excludedDates: [...current, dateKey] },
        });
      }

      return result;
    });

    // Emails only fire after the requester confirms (confirm/route.ts)
    return NextResponse.json({ request: updated });
  } catch (err) {
    console.error("[game-requests/[id]/approve PUT]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
