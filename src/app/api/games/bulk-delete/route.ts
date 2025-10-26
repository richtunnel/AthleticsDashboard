import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import { calendarService } from "@/lib/services/calendar.service";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = (await request.json().catch(() => null)) as { gameIds?: unknown; ids?: unknown } | null;

    const rawIds = body?.gameIds ?? body?.ids;

    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return NextResponse.json({ error: "No game IDs provided" }, { status: 400 });
    }

    const gameIds = Array.from(new Set(rawIds.map((id) => String(id))));

    const games = await prisma.game.findMany({
      where: {
        id: { in: gameIds },
        homeTeam: {
          organizationId: session.user.organizationId,
        },
      },
      select: {
        id: true,
        calendarSynced: true,
        googleCalendarEventId: true,
        createdById: true,
      },
    });

    const accessibleIds = new Set(games.map((game) => game.id));
    const missingIds = gameIds.filter((id) => !accessibleIds.has(id));

    if (missingIds.length > 0) {
      return NextResponse.json({ error: "Some games were not found or are unauthorized", missingIds }, { status: 404 });
    }

    const unauthorizedIds = games.filter((game) => game.createdById !== session.user.id).map((game) => game.id);

    if (unauthorizedIds.length > 0) {
      return NextResponse.json({ error: "Forbidden", unauthorizedIds }, { status: 403 });
    }

    const gamesWithEvents = games.filter((game) => game.calendarSynced && game.googleCalendarEventId);

    const calendarResults = await Promise.allSettled(
      gamesWithEvents.map((game) => calendarService.deleteCalendarEvent(session.user.id, game.googleCalendarEventId!))
    );

    let calendarSucceeded = 0;
    let calendarFailed = 0;

    calendarResults.forEach((result, index) => {
      const { id, googleCalendarEventId } = gamesWithEvents[index];
      if (result.status === "fulfilled" && result.value) {
        calendarSucceeded += 1;
      } else {
        calendarFailed += 1;
        const failureReason = result.status === "fulfilled" ? "Calendar delete returned false" : result.reason;
        console.error(`[Calendar] Bulk delete failed for game ${id} (event ${googleCalendarEventId}):`, failureReason);
      }
    });

    if (gamesWithEvents.length > 0) {
      console.info(
        `[Calendar] Bulk delete summary for user ${session.user.id}: attempted=${gamesWithEvents.length}, succeeded=${calendarSucceeded}, failed=${calendarFailed}`
      );
    } else {
      console.info(`[Calendar] Bulk delete summary for user ${session.user.id}: no calendar events to delete.`);
    }

    const deleteResult = await prisma.game.deleteMany({
      where: { id: { in: gameIds } },
    });

    console.info(
      `[Games] Bulk deleted ${deleteResult.count} game(s) for user ${session.user.id} (requested=${gameIds.length})`
    );

    return NextResponse.json({
      success: true,
      data: {
        deletedCount: deleteResult.count,
        calendar: {
          attempted: gamesWithEvents.length,
          succeeded: calendarSucceeded,
          failed: calendarFailed,
        },
      },
    });
  } catch (error) {
    console.error("Error bulk deleting games:", error);
    return NextResponse.json({ error: "Failed to delete games" }, { status: 500 });
  }
}
