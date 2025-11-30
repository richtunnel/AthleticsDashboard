import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { sport, level, date, time } = body;

    console.log("Conflict detection request:", { sport, level, date, time });

    // Validate required fields
    if (!sport || !level || !date || !time) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          received: { sport: !!sport, level: !!level, date: !!date, time: !!time },
        },
        { status: 400 }
      );
    }

    // Use level exactly as typed by user - no conversion
    console.log("Using level as entered:", { level });

    // Fetch all games for the same sport and level
    const games = await prisma.game.findMany({
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

    // Check for time conflicts on the same date
    const targetDate = new Date(date).toISOString().split("T")[0];
    const conflicts = games.filter((game) => {
      const gameDate = new Date(game.date).toISOString().split("T")[0];
      return gameDate === targetDate && game.time === time;
    });

    const hasConflict = conflicts.length > 0;

    // Generate suggested alternative times if there's a conflict
    const suggestedTimes: string[] = [];
    if (hasConflict) {
      const usedTimes = new Set(
        games
          .filter((game) => new Date(game.date).toISOString().split("T")[0] === targetDate)
          .map((game) => game.time)
          .filter(Boolean)
      );

      // Common game times to suggest
      const commonTimes = ["15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30"];

      for (const suggestedTime of commonTimes) {
        if (!usedTimes.has(suggestedTime) && suggestedTimes.length < 3) {
          suggestedTimes.push(suggestedTime);
        }
      }
    }

    console.log("Conflict detection result:", { hasConflict, conflictCount: conflicts.length });

    return NextResponse.json({
      success: true,
      hasConflict,
      conflicts: conflicts.map((conflict) => ({
        gameId: conflict.id,
        date: conflict.date,
        time: conflict.time,
        sport: conflict.homeTeam.sport.name,
        level: conflict.homeTeam.level,
        opponent: conflict.opponent?.name || "TBD",
      })),
      suggestedTimes,
    });
  } catch (error) {
    console.error("Error detecting conflicts:", error);
    return NextResponse.json(
      {
        error: "Failed to detect conflicts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
