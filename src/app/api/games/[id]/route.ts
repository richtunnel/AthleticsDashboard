import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import { calendarService } from "@/lib/services/calendar.service";
import { travelAIService } from "@/lib/services/travelAI";

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
    
    // Handle empty or malformed request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error("Error parsing request body:", error);
      return NextResponse.json(
        { error: "Invalid request body. Expected valid JSON." },
        { status: 400 }
      );
    }

    // Validate that body is not empty
    if (!body || Object.keys(body).length === 0) {
      return NextResponse.json(
        { error: "Request body cannot be empty" },
        { status: 400 }
      );
    }

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
        customFields: true,
        travelRequired: true,
        venueId: true,
      },
    });

    if (!existingGame) {
      return NextResponse.json({ error: "Game not found or unauthorized" }, { status: 404 });
    }

    // Separate custom data and custom fields from regular fields
    const { customData, customFields, ...regularData } = body;

    const updateData: any = { ...regularData };

    // Normalize time field - convert empty strings to null and validate format
    if ('time' in updateData) {
      if (updateData.time === "" || updateData.time === null || updateData.time === undefined) {
        updateData.time = null;
      } else if (typeof updateData.time === 'string') {
        const trimmedTime = updateData.time.trim();
        if (trimmedTime === "") {
          updateData.time = null;
        } else {
          // Validate time format (HH:MM)
          const timePattern = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
          if (!timePattern.test(trimmedTime)) {
            return NextResponse.json(
              { error: "Invalid time format. Expected HH:MM (e.g., 14:30)" },
              { status: 400 }
            );
          }
          updateData.time = trimmedTime;
        }
      }
    }

    // Validate notes field character limit
    const MAX_CHAR_LIMIT = 2500;
    if (updateData.notes && typeof updateData.notes === "string" && updateData.notes.length > MAX_CHAR_LIMIT) {
      return NextResponse.json(
        { error: `Notes field exceeds maximum length of ${MAX_CHAR_LIMIT} characters` },
        { status: 400 }
      );
    }

    // Validate location field character limit
    if (updateData.location && typeof updateData.location === "string" && updateData.location.length > MAX_CHAR_LIMIT) {
      return NextResponse.json(
        { error: `Location field exceeds maximum length of ${MAX_CHAR_LIMIT} characters` },
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

    // Handle custom fields separately (merge with existing)
    if (customFields !== undefined) {
      const existingCustomFields = (existingGame.customFields as any) || {};
      const mergedCustomFields: any = { ...existingCustomFields, ...customFields };

      // Validate custom fields character limits
      for (const [key, value] of Object.entries(mergedCustomFields)) {
        if (typeof value === "string" && value.length > MAX_CHAR_LIMIT) {
          return NextResponse.json(
            { error: `Custom field "${key}" exceeds maximum length of ${MAX_CHAR_LIMIT} characters` },
            { status: 400 }
          );
        }
      }

      updateData.customFields = mergedCustomFields;
    }

    // Update using only the unique ID (after validation)
    let game = await prisma.game.update({
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

    const currentVenueId = game.venue?.id ?? game.venueId ?? null;
    const travelRequirementActivated = game.travelRequired && !existingGame.travelRequired;
    const venueAdded = game.travelRequired && !existingGame.venueId && currentVenueId;
    const venueChanged = game.travelRequired && existingGame.venueId && currentVenueId && existingGame.venueId !== currentVenueId;
    const shouldAttemptAutoFill = Boolean(currentVenueId && (travelRequirementActivated || venueAdded || venueChanged));

    if (shouldAttemptAutoFill) {
      try {
        const travelSettings = await prisma.travelSettings.findUnique({
          where: { organizationId: session.user.organizationId },
        });

        if (travelSettings?.autoFillEnabled) {
          await travelAIService.createTravelRecommendation(game.id, session.user.organizationId, { autoApply: true });
          const refreshedGame = await prisma.game.findUnique({
            where: { id: game.id },
            include: {
              homeTeam: {
                include: { sport: true },
              },
              opponent: true,
              venue: true,
            },
          });

          if (refreshedGame) {
            game = refreshedGame;
          }
        }
      } catch (error) {
        console.error("Error checking travel settings:", error);
        // Don't fail the game update if auto-fill fails
      }
    }

    // Auto-sync to calendar if enabled and game is already synced
    try {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { autoCalendarSyncEnabled: true },
      });

      if (user?.autoCalendarSyncEnabled && game.googleCalendarEventId) {
        await calendarService.syncGameToCalendar(game.id, session.user.id);
      }
    } catch (error) {
      console.error("Error auto-syncing to calendar:", error);
      // Don't fail the game update if auto-sync fails
    }

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
