import { NextRequest, NextResponse } from "next/server";
import { getAnySession } from "@/lib/utils/collaboratorSession";
import { prisma } from "@/lib/database/prisma";
import { computeAvailableDates } from "@/lib/availability/computeAvailableDates";

/**
 * GET /api/schedule-board/[id]/dates
 *
 * Returns available dates for a specific SchedulePost (identified by its id).
 * Called lazily — only when the user selects a sport combo inside the
 * View Schedule modal, so we never compute dates we don't need.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAnySession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const post = await prisma.schedulePost.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            organization: { select: { timezone: true } },
          },
        },
      },
    });


    if (!post || !post.isActive) {
      return NextResponse.json({ error: "Schedule post not found" }, { status: 404 });
    }

    const availableDates = await computeAvailableDates(
      post.workbookId,
      post.sport,
      post.level,
      post.gender,
      {
        excludeWeekends: post.excludeWeekends,
        excludedDates:   (post.excludedDates as string[]) ?? [],
      }
    );

    return NextResponse.json({
      postId:   post.id,
      sport:    post.sport,
      level:    post.level,
      gender:   post.gender,
      timezone: post.user.organization?.timezone ?? "America/New_York",
      availableDates: availableDates.map((d) => ({
        date:       d.dateISO,
        dayOfWeek:  d.dayOfWeek,
        timeWindow: d.timeWindow,
      })),
    });
  } catch (err) {
    console.error("[schedule-board/[id]/dates GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
