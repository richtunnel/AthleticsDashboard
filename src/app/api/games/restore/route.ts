import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import { calendarService } from "@/lib/services/calendar.service";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { games } = body;

    if (!Array.isArray(games) || games.length === 0) {
      return NextResponse.json({ error: "No games provided for restoration" }, { status: 400 });
    }

    const restoredGames = [];
    const calendarSyncResults = {
      attempted: 0,
      succeeded: 0,
      failed: 0,
    };

    for (const gameBackup of games) {
      try {
        const gameData = gameBackup.data;

        // Validate that the game's team belongs to the user's organization
        if (gameData.homeTeam && gameData.homeTeam.organizationId !== session.user.organizationId) {
          console.error(`Unauthorized restore attempt for game ${gameBackup.id}`);
          continue;
        }

        // Restore the game with original ID
        const restoredGame = await prisma.game.create({
          data: {
            id: gameBackup.id,
            date: new Date(gameData.date),
            time: gameData.time || null,
            status: gameData.status || "SCHEDULED",
            isHome: gameData.isHome ?? true,
            travelRequired: gameData.travelRequired ?? false,
            busTravel: gameData.busTravel ?? false,
            estimatedTravelTime: gameData.estimatedTravelTime || null,
            actualDepartureTime: gameData.actualDepartureTime ? new Date(gameData.actualDepartureTime) : null,
            actualArrivalTime: gameData.actualArrivalTime ? new Date(gameData.actualArrivalTime) : null,
            homeTeamId: gameData.homeTeamId,
            opponentId: gameData.opponentId || null,
            venueId: gameData.venueId || null,
            notes: gameData.notes || null,
            location: gameData.location || null,
            customData: gameData.customData || {},
            customFields: gameData.customFields || {},
            sortOrder: gameData.sortOrder || null,
            isSampleGame: gameData.isSampleGame || false,
            createdById: session.user.id,
            calendarSynced: false, // Will be synced below if needed
            googleCalendarEventId: null, // Will be set after sync
          },
        });

        restoredGames.push(restoredGame);

        // Attempt to sync to Google Calendar if it was previously synced
        if (gameData.calendarSynced && gameData.googleCalendarEventId) {
          calendarSyncResults.attempted++;
          try {
            // Create new calendar event (don't try to restore old event ID)
            await calendarService.syncGameToCalendar(restoredGame.id, session.user.id);
            calendarSyncResults.succeeded++;
          } catch (calendarError) {
            console.error(`Failed to sync restored game ${restoredGame.id} to calendar:`, calendarError);
            calendarSyncResults.failed++;
          }
        }
      } catch (error) {
        console.error(`Failed to restore game ${gameBackup.id}:`, error);
        // Continue with other games even if one fails
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        restoredCount: restoredGames.length,
        games: restoredGames,
        calendar: calendarSyncResults,
      },
    });
  } catch (error) {
    console.error("Error restoring games:", error);
    return NextResponse.json({ error: "Failed to restore games" }, { status: 500 });
  }
}
