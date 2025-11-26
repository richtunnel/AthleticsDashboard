import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import { GameStatus } from "../../../../../../types/main.types";
import { deleteSampleGames } from "@/lib/services/sample-game.service";

interface ImportGameData {
  date: string;
  customFields?: Record<string, any>; // All non-date columns stored here
}

// Helper function to validate date string
function validateAndParseDate(dateString: string): Date {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateString}`);
  }
  return date;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { games, customColumns, columnMapping } = await request.json();

    if (!games || !Array.isArray(games)) {
      return NextResponse.json({ success: false, error: "Invalid games data" }, { status: 400 });
    }

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const warnings: string[] = [];
    const createdGameIds: string[] = [];

    // Find or create default team for custom-only imports
    let defaultTeam = await prisma.team.findFirst({
      where: {
        name: "General Schedule",
        organizationId: session.user.organizationId,
      },
      include: {
        sport: true,
      },
    });

    if (!defaultTeam) {
      // Create default sport if needed
      let defaultSport = await prisma.sport.findFirst({
        where: { name: "General" },
      });

      if (!defaultSport) {
        defaultSport = await prisma.sport.create({
          data: {
            name: "General",
            season: "FALL",
          },
        });
      }

      // Create default team
      defaultTeam = await prisma.team.create({
        data: {
          name: "General Schedule",
          sportId: defaultSport.id,
          level: "VARSITY",
          organizationId: session.user.organizationId,
        },
        include: {
          sport: true,
        },
      });
    }

    // Process each game
    for (let i = 0; i < games.length; i++) {
      const gameData = games[i] as ImportGameData;
      const rowNum = i + 1;

      try {
        // === VALIDATE DATE (ONLY REQUIRED FIELD) ===
        if (!gameData.date) {
          errors.push(`Row ${rowNum}: Missing required field (date)`);
          failedCount++;
          continue;
        }

        // Validate and parse date
        let parsedDate: Date;
        try {
          parsedDate = validateAndParseDate(gameData.date);
        } catch (dateError) {
          errors.push(`Row ${rowNum}: ${dateError instanceof Error ? dateError.message : 'Invalid date'}`);
          failedCount++;
          continue;
        }

        // === CREATE GAME WITH DATE AND CUSTOM FIELDS ===
        const gameCreateData = {
          date: parsedDate,
          homeTeamId: defaultTeam.id,
          isHome: true, // Default value
          status: "SCHEDULED" as GameStatus,
          customFields: gameData.customFields || {},
          createdById: session.user.id,
          sortOrder: 0,
        };

        const createdGame = await prisma.game.create({
          data: gameCreateData,
          include: {
            homeTeam: {
              include: {
                sport: true,
              },
            },
          },
        });

        // === VALIDATE CREATED GAME ===
        if (!createdGame || !createdGame.id) {
          errors.push(`Row ${rowNum}: Game creation failed - no ID returned`);
          failedCount++;
          continue;
        }

        // === SUCCESS ===
        createdGameIds.push(createdGame.id);
        successCount++;

      } catch (error) {
        console.error(`Row ${rowNum} import error:`, error);
        errors.push(`Row ${rowNum}: ${error instanceof Error ? error.message : "Unknown error"}`);
        failedCount++;
      }
    }

    // If import was successful and we have created games, delete sample games
    if (successCount > 0) {
      try {
        await deleteSampleGames(session.user.id);
        console.log(`[Import] Deleted sample games after successful import for user ${session.user.id}`);
      } catch (sampleDeleteError) {
        console.error("[Import] Failed to delete sample games:", sampleDeleteError);
        // Don't fail the import if sample deletion fails
      }
    }

    // Save custom column configuration as user preferences if provided
    if (customColumns && columnMapping) {
      try {
        await prisma.tablePreference.upsert({
          where: {
            userId_tableKey: {
              userId: session.user.id,
              tableKey: "games",
            },
          },
          create: {
            userId: session.user.id,
            tableKey: "games",
            preferences: {
              customColumns,
              columnMapping,
              importedAt: new Date().toISOString(),
            },
          },
          update: {
            preferences: {
              customColumns,
              columnMapping,
              importedAt: new Date().toISOString(),
            },
          },
        });
        console.log(`[Import] Saved custom column configuration for user ${session.user.id}`);
      } catch (prefError) {
        console.error("[Import] Failed to save column preferences:", prefError);
        // Don't fail the import if preference saving fails
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        success: successCount,
        failed: failedCount,
        errors,
        warnings,
        createdGameIds,
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
