import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import { calendarService } from "@/lib/services/calendar.service";
import { travelAIService } from "@/lib/services/travelAI";
import { normalizeTimeFormat } from "@/lib/utils/timeValidation";
import { filterRestrictedGameFields } from "@/lib/security/plan-limits";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const game = await prisma.game.findFirst({
      where: {
        id,
        homeTeam: {
          organizationId: session.user.organizationId,
        },
      },
      include: {
        homeTeam: {
          include: { sport: true },
        },
        opponent: true,
        venue: true,
      },
    });

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: game });
  } catch (error) {
    console.error("Error fetching game:", error);
    return NextResponse.json({ error: "Failed to fetch game" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id: gameId } = await params;

    if (!gameId) {
      return NextResponse.json({ success: false, error: "Game ID required" }, { status: 400 });
    }

    let body = await request.json();

    // Filter restricted fields based on plan
    body = await filterRestrictedGameFields(session.user.id, body);

    // Validate that the game belongs to user's organization
    const existingGame = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        homeTeam: {
          select: { organizationId: true },
        },
      },
    });

    if (!existingGame || existingGame.homeTeam.organizationId !== session.user.organizationId) {
      return NextResponse.json({ success: false, error: "Game not found or unauthorized" }, { status: 404 });
    }

    // Normalize time field - convert empty strings to null and validate/normalize format
    if ("time" in body) {
      try {
        body.time = normalizeTimeFormat(body.time);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid time format";
        return NextResponse.json(
          {
            success: false,
            error: `${message}. Use HH:MM format (e.g., 14:30, 09:00) for Google Calendar compatibility.`,
          },
          { status: 400 }
        );
      }
    }

    if (body.customFields) {
      // Get user's column mapping to find which custom field maps to date
      const userPrefs = await prisma.tablePreference.findUnique({
        where: {
          userId_tableKey: { userId: session.user.id, tableKey: "games" },
        },
      });

      const preferences = userPrefs?.preferences as any;
      const columnMapping = preferences?.columnMapping as Record<string, string> | undefined;
      if (columnMapping) {
        const dateColumnName = Object.keys(columnMapping).find((col) => columnMapping[col] === "date");
        if (dateColumnName && body.customFields[dateColumnName]) {
          // Also update the main date field so calendar widget sees the change
          body.date = new Date(body.customFields[dateColumnName]);
        }

        // Also check for time column mapping and normalize
        const timeColumnName = Object.keys(columnMapping).find((col) => columnMapping[col] === "time");
        if (timeColumnName && body.customFields[timeColumnName]) {
          try {
            const normalizedTime = normalizeTimeFormat(body.customFields[timeColumnName]);
            body.customFields[timeColumnName] = normalizedTime;
            // Also update the main time field for consistency
            body.time = normalizedTime;
          } catch (error) {
            const message = error instanceof Error ? error.message : "Invalid time format";
            return NextResponse.json(
              {
                success: false,
                error: `Invalid time in imported column "${timeColumnName}": ${message}`,
              },
              { status: 400 }
            );
          }
        }
      }
    }

    // Update the game with the provided data
    const updatedGame = await prisma.game.update({
      where: { id: gameId },
      data: body,
      include: {
        homeTeam: {
          include: { sport: true },
        },
        opponent: true,
        venue: true,
      },
    });

    return NextResponse.json({ success: true, data: updatedGame });
  } catch (error) {
    console.error("Error updating game:", error);
    return NextResponse.json({ success: false, error: "Failed to update game" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const userId = session.user.id;

    const game = await prisma.game.findFirst({
      where: {
        id,
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

    if (!game) {
      return NextResponse.json({ error: "Game not found or unauthorized" }, { status: 404 });
    }

    if (game.createdById !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const shouldDeleteFromCalendar = Boolean(game.calendarSynced && game.googleCalendarEventId);
    let calendarDeletionSucceeded: boolean | null = null;

    if (shouldDeleteFromCalendar) {
      calendarDeletionSucceeded = await calendarService.deleteCalendarEvent(userId, game.googleCalendarEventId!);

      if (!calendarDeletionSucceeded) {
        console.error(`[Calendar] Failed to delete Google Calendar event ${game.googleCalendarEventId} for game ${game.id}`);
      }
    } else {
      console.info(`[Calendar] Game ${game.id} is not synced to Google Calendar or missing an event ID; skipping calendar deletion.`);
    }

    await prisma.game.delete({
      where: { id: game.id },
    });

    console.info(`[Games] Deleted game ${game.id} for user ${userId}`);

    return NextResponse.json({
      success: true,
      calendar: {
        attempted: shouldDeleteFromCalendar,
        succeeded: shouldDeleteFromCalendar ? calendarDeletionSucceeded === true : null,
      },
    });
  } catch (error) {
    console.error("Error deleting game:", error);
    return NextResponse.json({ error: "Failed to delete game" }, { status: 500 });
  }
}
