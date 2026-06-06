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
      where:  { id },
      select: {
        id: true, workbookId: true, sport: true, level: true, gender: true,
        isActive: true, excludeWeekends: true, excludedDates: true, extraDates: true,
        user: { select: { organization: { select: { timezone: true } } } },
      },
    });


    if (!post || !post.isActive) {
      return NextResponse.json({ error: "Schedule post not found" }, { status: 404 });
    }

    const tz             = post.user.organization?.timezone ?? "America/New_York";
    const excludedDates  = (post.excludedDates as string[]) ?? [];
    const extraEntries   = (post.extraDates    as Array<{ date: string; timeWindow: string | null }>) ?? [];

    const computedDates = await computeAvailableDates(
      post.workbookId,
      post.sport,
      post.level,
      post.gender,
      { excludeWeekends: post.excludeWeekends, excludedDates },
    );

    // Manually added dates: exclude any that are in the excluded set, then format.
    const excludedSet  = new Set(excludedDates.map((d) => d.slice(0, 10)));
    const computedKeys = new Set(computedDates.map((d) => d.dateISO.slice(0, 10)));
    const manualDates  = extraEntries
      .filter((e) => !excludedSet.has(e.date.slice(0, 10)) && !computedKeys.has(e.date.slice(0, 10)))
      .map((e) => ({
        date:       e.date.slice(0, 10) + "T12:00:00.000Z",
        dayOfWeek:  new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: tz }).format(
                      new Date(e.date.slice(0, 10) + "T12:00:00Z")
                    ),
        timeWindow: e.timeWindow,
        source:     "manual" as const,
      }));

    const allDates = [
      ...computedDates.map((d) => ({ date: d.dateISO, dayOfWeek: d.dayOfWeek, timeWindow: d.timeWindow, source: "computed" as const })),
      ...manualDates,
    ].sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      postId:   post.id,
      sport:    post.sport,
      level:    post.level,
      gender:   post.gender,
      timezone: tz,
      availableDates: allDates,
    });
  } catch (err) {
    console.error("[schedule-board/[id]/dates GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
