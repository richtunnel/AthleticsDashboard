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
    if (gr.requesterUserId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (gr.status !== "APPROVED") return NextResponse.json({ error: "Request is not approved" }, { status: 400 });

    const updated = await prisma.gameRequest.update({
      where: { id },
      data:  { status: "CONFIRMED", confirmedByRequester: true, readByRequester: true },
    });

    // Send confirmation emails to both parties immediately
    const dateStr = gr.availableDate.toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
    const sport = `${gr.gender === "MALE" ? "Boys" : gr.gender === "FEMALE" ? "Girls" : "Co-ed"} ${gr.level} ${gr.sport}`;

    const emails: Promise<unknown>[] = [];

    if (gr.owner?.email) {
      emails.push(emailService.sendEmail({
        to:        [gr.owner.email],
        subject:   `🏆 Game Confirmed — ${sport} vs. ${gr.requester?.schoolName || gr.requester?.name}`,
        body:      `Hi ${gr.owner.name || "Coach"},\n\n${gr.requester?.schoolName || "The requesting school"} has confirmed the ${sport} game on ${dateStr}. The game is now locked in on both sides.\n\nLog in to view the full details.\n\nhttps://opletics.com/dashboard/posts?tab=3`,
        immediate: true,
      }));
    }

    if (gr.requester?.email) {
      emails.push(emailService.sendEmail({
        to:        [gr.requester.email],
        subject:   `🏆 Game Confirmed — ${sport} vs. ${gr.owner?.schoolName || gr.owner?.name}`,
        body:      `Hi ${gr.requester.name || "Coach"},\n\nYou've confirmed the ${sport} game with ${gr.owner?.schoolName || "the school"} on ${dateStr}. The game is now locked in — head to Game Center to sync it to your schedule.\n\nhttps://opletics.com/dashboard/posts?tab=3`,
        immediate: true,
      }));
    }

    await Promise.all(emails);

    // Also enqueue the background job as a backup/retry safety net
    await prisma.backgroundJob.create({
      data: {
        type:    "GAME_REQUEST_CONFIRM",
        payload: { gameRequestId: id },
        userId:  session.user.id,
      },
    }).catch(() => { /* non-critical — direct emails already sent */ });

    return NextResponse.json({ request: updated });
  } catch (err) {
    console.error("[game-requests/[id]/confirm PUT]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
