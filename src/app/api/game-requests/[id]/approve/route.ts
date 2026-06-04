import { NextRequest, NextResponse } from "next/server";
import { getAnySession } from "@/lib/utils/collaboratorSession";
import { prisma } from "@/lib/database/prisma";
import { emailService } from "@/lib/services/email.service";

export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAnySession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const gr = await prisma.gameRequest.findUnique({
      where: { id },
      include: {
        requester: { select: { email: true, name: true, schoolName: true } },
        owner:     { select: { email: true, name: true, schoolName: true } },
      },
    });

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

    // Notify requester
    if (gr.requester?.email) {
      const dateStr = gr.availableDate.toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      });
      await emailService.sendEmail({
        to:        [gr.requester.email],
        subject:   `✅ Your game request has been approved by ${gr.owner?.schoolName || gr.owner?.name}`,
        body:      `Hi ${gr.requester.name || "Coach"},\n\n${gr.owner?.schoolName || "The school"} has approved your request to schedule a ${gr.sport} game on ${dateStr}.\n\nPlease log in to confirm the game and sync it to your schedule.\n\nhttps://opletics.com/dashboard/posts?tab=3`,
        immediate: true,
      });
    }

    return NextResponse.json({ request: updated });
  } catch (err) {
    console.error("[game-requests/[id]/approve PUT]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
