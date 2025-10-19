import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import { TeamLevel, GameStatus } from "../../../../../../types/main.types";

interface ImportGameData {
  date: string;
  time?: string | null;
  sport: string;
  level: string;
  opponent?: string | null;
  isHome: boolean;
  venue?: string | null;
  status?: string;
  notes?: string | null;
}

// Helper function to normalize level strings to enum
function normalizeLevel(level: string): TeamLevel {
  const normalized = level.toUpperCase().trim();

  const levelMap: { [key: string]: TeamLevel } = {
    VARSITY: "VARSITY",
    V: "VARSITY",
    VAR: "VARSITY",
    JV: "JV",
    "JUNIOR VARSITY": "JV",
    FRESHMAN: "FRESHMAN",
    FROSH: "FRESHMAN",
    F: "FRESHMAN",
    "MIDDLE SCHOOL": "MIDDLE_SCHOOL",
    MS: "MIDDLE_SCHOOL",
    MIDDLE: "MIDDLE_SCHOOL",
    YOUTH: "YOUTH",
    Y: "YOUTH",
  };

  return levelMap[normalized] || "VARSITY"; // Default to VARSITY if not found
}

// Helper function to normalize status strings to enum
function normalizeStatus(status?: string): GameStatus {
  if (!status) return "SCHEDULED";

  const normalized = status.toUpperCase().trim();

  const statusMap: { [key: string]: GameStatus } = {
    SCHEDULED: "SCHEDULED",
    CONFIRMED: "CONFIRMED",
    POSTPONED: "POSTPONED",
    CANCELLED: "CANCELLED",
    CANCELED: "CANCELLED",
    COMPLETED: "COMPLETED",
    COMPLETE: "COMPLETED",
    FINISHED: "COMPLETED",
  };

  return statusMap[normalized] || "SCHEDULED";
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { games } = await request.json();

    if (!games || !Array.isArray(games)) {
      return NextResponse.json({ success: false, error: "Invalid games data" }, { status: 400 });
    }

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // Process each game
    for (let i = 0; i < games.length; i++) {
      const gameData = games[i] as ImportGameData;

      try {
        // Validate required fields
        if (!gameData.date || !gameData.sport || !gameData.level) {
          errors.push(`Row ${i + 1}: Missing required fields (date, sport, or level)`);
          failedCount++;
          continue;
        }

        // Normalize level and status to enum values
        const normalizedLevel = normalizeLevel(gameData.level);
        const normalizedStatus = normalizeStatus(gameData.status);

        // Find or create sport
        let sport = await prisma.sport.findFirst({
          where: {
            name: {
              equals: gameData.sport,
              mode: "insensitive",
            },
          },
        });

        if (!sport) {
          sport = await prisma.sport.create({
            data: {
              name: gameData.sport,
              season: "FALL", // Default season
            },
          });
        }

        // Find or create team
        let team = await prisma.team.findFirst({
          where: {
            sportId: sport.id,
            level: normalizedLevel,
            organizationId: session.user.organizationId,
          },
        });

        if (!team) {
          team = await prisma.team.create({
            data: {
              name: `${gameData.sport} ${normalizedLevel}`,
              sportId: sport.id,
              level: normalizedLevel,
              organizationId: session.user.organizationId,
            },
          });
        }

        // Find or create opponent if provided
        let opponentId: string | null = null;
        if (gameData.opponent) {
          let opponent = await prisma.opponent.findFirst({
            where: {
              name: {
                equals: gameData.opponent,
                mode: "insensitive",
              },
              organizationId: session.user.organizationId,
            },
          });

          if (!opponent) {
            opponent = await prisma.opponent.create({
              data: {
                name: gameData.opponent,
                organizationId: session.user.organizationId,
              },
            });
          }

          opponentId = opponent.id;
        }

        // Find or create venue if provided
        let venueId: string | null = null;
        if (gameData.venue && !gameData.isHome) {
          let venue = await prisma.venue.findFirst({
            where: {
              name: {
                equals: gameData.venue,
                mode: "insensitive",
              },
              organizationId: session.user.organizationId,
            },
          });

          if (!venue) {
            venue = await prisma.venue.create({
              data: {
                name: gameData.venue,
                organizationId: session.user.organizationId,
              },
            });
          }

          venueId = venue.id;
        }

        // Create game
        await prisma.game.create({
          data: {
            date: new Date(gameData.date),
            time: gameData.time || null,
            homeTeamId: team.id,
            opponentId,
            venueId,
            isHome: gameData.isHome,
            status: normalizedStatus,
            notes: gameData.notes || null,
            createdById: session.user.id,
          },
        });

        successCount++;
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`);
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        success: successCount,
        failed: failedCount,
        errors,
      },
    });
  } catch (error) {
    console.error("Batch import error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to import games",
      },
      { status: 500 }
    );
  }
}
