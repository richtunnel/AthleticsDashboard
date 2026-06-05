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

    // Notify the requester by email so they know to confirm
    if (gr.requester?.email) {
      const dateStr = gr.availableDate.toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      });
      const sport = `${gr.gender === "MALE" ? "Boys" : gr.gender === "FEMALE" ? "Girls" : "Co-ed"} ${gr.level} ${gr.sport}`;
      const ownerSchool = gr.owner?.schoolName || gr.owner?.name || "the school";

      const confirmUrl = `https://opletics.com/dashboard/posts?tab=3`;
      emailService.sendEmail({
        to:      [gr.requester.email],
        subject: `Action Required — Confirm Your ${sport} Game with ${ownerSchool}`,
        body: [
          `Hi ${gr.requester.name || "Coach"},`,
          "",
          `Great news! ${ownerSchool} has approved your ${sport} game request for ${dateStr}.`,
          "",
          "ACTION REQUIRED — you must confirm to lock the game in:",
          "",
          `  → Confirm your game here: ${confirmUrl}`,
          "",
          "Steps to confirm:",
          "  1. Click the link above to open Game Requests",
          `  2. Find the ${sport} request under \"Approved — Awaiting Confirmation\"`,
          "  3. Click the Confirm button on the request card",
          "",
          "Once confirmed, both schools will receive a final confirmation email and the game will be ready to sync to your schedule.",
          "",
          "If you have any questions, reply to this email or contact us at support@opletics.com.",
        ].join("\n"),
        immediate: true,
      }).catch((err) => console.warn("[game-requests/approve] approval email failed:", err));
    }

    return NextResponse.json({ request: updated });
  } catch (err) {
    console.error("[game-requests/[id]/approve PUT]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
