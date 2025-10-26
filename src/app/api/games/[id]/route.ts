import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import { calendarService } from "@/lib/services/calendar.service";

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
    const { id } = await params;
    const body = await request.json();

    // ✅ VALIDATE: Game belongs to user's organization
    const existingGame = await prisma.game.findFirst({
      where: {
        id,
        homeTeam: {
          organizationId: session.user.organizationId,
        },
      },
      select: {
        id: true,
        customData: true,
      },
    });

    if (!existingGame) {
      return NextResponse.json({ error: "Game not found or unauthorized" }, { status: 404 });
    }

    // Separate custom data from regular fields
    const { customData, ...regularData } = body;

    const updateData: any = { ...regularData };

    // Validate notes field character limit
    const MAX_CHAR_LIMIT = 2500;
    if (updateData.notes && typeof updateData.notes === "string" && updateData.notes.length > MAX_CHAR_LIMIT) {
      return NextResponse.json(
        { error: `Notes field exceeds maximum length of ${MAX_CHAR_LIMIT} characters` },
        { status: 400 }
      );
    }

    // Handle custom data separately (merge with existing)
    if (customData !== undefined) {
      const existingCustomData = (existingGame.customData as any) || {};
      const mergedCustomData: any = { ...existingCustomData, ...customData };

      // Validate custom data fields character limits
      for (const [key, value] of Object.entries(mergedCustomData)) {
        if (typeof value === "string" && value.length > MAX_CHAR_LIMIT) {
          return NextResponse.json(
            { error: `Custom field "${key}" exceeds maximum length of ${MAX_CHAR_LIMIT} characters` },
            { status: 400 }
          );
        }
      }

      updateData.customData = mergedCustomData;
    }

    // Update using only the unique ID (after validation)
    const game = await prisma.game.update({
      where: { id },
      data: updateData,
      include: {
        homeTeam: {
          include: { sport: true },
        },
        opponent: true,
        venue: true,
      },
    });

    return NextResponse.json(game);
  } catch (error) {
    console.error("Error updating game:", error);
    return NextResponse.json({ error: "Failed to update game" }, { status: 500 });
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
