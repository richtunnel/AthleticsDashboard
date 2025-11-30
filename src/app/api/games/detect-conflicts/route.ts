import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import { GameTimePatternService } from "@/lib/services/game-time-pattern.service";

/**
 * POST /api/games/detect-conflicts
 * Detects scheduling conflicts for a game
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const { sport, level, date, time, excludeGameId } = body;

    // Validate required fields
    if (!sport || !level || !date) {
      return NextResponse.json({ error: "Sport, level, and date are required" }, { status: 400 });
    }

    // Fetch all games for the same sport and level - use level exactly as typed by user
    const gamesFromPrisma = await prisma.game.findMany({
      where: {
        createdById: session.user.id,
        homeTeam: {
          sport: {
            name: sport,
          },
          level: level, // Use exactly what the user typed - no conversion
        },
      },
      include: {
        homeTeam: {
          include: {
            sport: true,
          },
        },
        opponent: true,
      },
    });

    // Convert Date objects to strings for the service
    const games = gamesFromPrisma.map((game) => ({
      ...game,
      date: game.date.toISOString().split("T")[0], // Convert Date to YYYY-MM-DD string
    }));

    // Ensure the input date is a string
    const newDate = typeof date === "string" ? date : date.toISOString().split("T")[0];

    // Detect conflicts
    const conflictInfo = GameTimePatternService.detectConflicts(games, newDate, time, sport, level, excludeGameId);

    return NextResponse.json({
      success: true,
      ...conflictInfo,
    });
  } catch (error) {
    console.error("Error detecting conflicts:", error);
    return NextResponse.json({ error: "Failed to detect conflicts" }, { status: 500 });
  }
}
