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
    if (gr.requesterUserId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!["APPROVED", "PENDING"].includes(gr.status)) {
      return NextResponse.json({ error: "Cannot cancel at this stage" }, { status: 400 });
    }

    const wasApproved = gr.status === "APPROVED";

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.gameRequest.update({
        where: { id },
        data:  { status: "CANCELLED" },
      });

      // If the request was already approved the date was locked in excludedDates — restore it
      if (wasApproved) {
        const dateKey = gr.availableDate.toISOString().slice(0, 10);
        const post = await tx.schedulePost.findUnique({
          where:  { id: gr.schedulePostId },
          select: { excludedDates: true },
        });
        const current = (post?.excludedDates as string[]) ?? [];
        await tx.schedulePost.update({
          where: { id: gr.schedulePostId },
          data:  { excludedDates: current.filter((d) => d !== dateKey) },
        });
      }

      return result;
    });

    return NextResponse.json({ request: updated });
  } catch (err) {
    console.error("[game-requests/[id]/cancel PUT]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
