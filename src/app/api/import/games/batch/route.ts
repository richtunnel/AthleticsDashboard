import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import { GameStatus } from "../../../../../../types/main.types";
import { deleteSampleGames } from "@/lib/services/sample-game.service";
import { detectAndCreateOpponents } from "@/lib/services/opponent-detection.service";
import { normalizeTimeFormat } from "@/lib/utils/timeValidation";
import { withCSRFProtection } from "@/lib/security/csrf";

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

/**
 * Check if an imported row is a duplicate of an existing game.
 * A row is considered duplicate if ALL of the following match:
 * 1. Same date
 * 2. ALL custom field keys and values match exactly
 */
async function isDuplicateRow(
  date: Date,
  customFields: Record<string, any>,
  organizationId: string
): Promise<boolean> {
  // Normalize the date to compare (ignore time portion)
  const dateStr = date.toISOString().split("T")[0];

  // Fetch all games for this organization on the same date
  const existingGames = await prisma.game.findMany({
    where: {
      homeTeam: {
        organizationId: organizationId,
      },
      date: {
        gte: new Date(dateStr + "T00:00:00.000Z"),
        lte: new Date(dateStr + "T23:59:59.999Z"),
      },
    },
    select: {
      id: true,
      customFields: true,
    },
  });

  // If no games on this date, it's not a duplicate
  if (existingGames.length === 0) {
    return false;
  }

  // Normalize custom fields for comparison (remove null/undefined values)
  const normalizeFields = (fields: Record<string, any>): Record<string, any> => {
    const normalized: Record<string, any> = {};
    for (const [key, value] of Object.entries(fields || {})) {
      // Only include non-null, non-undefined, non-empty values
      if (value !== null && value !== undefined && value !== "") {
        normalized[key] = String(value).trim(); // Convert to string and trim for comparison
      }
    }
    return normalized;
  };

  const normalizedImportFields = normalizeFields(customFields);
  const importKeys = Object.keys(normalizedImportFields).sort();

  // Check each existing game to see if it matches ALL fields
  for (const existingGame of existingGames) {
    const normalizedExistingFields = normalizeFields(existingGame.customFields as Record<string, any> || {});
    const existingKeys = Object.keys(normalizedExistingFields).sort();

    // Check if both have the same keys
    if (JSON.stringify(importKeys) !== JSON.stringify(existingKeys)) {
      continue; // Different set of columns, not a duplicate
    }

    // Check if ALL values match
    let allValuesMatch = true;
    for (const key of importKeys) {
      if (normalizedImportFields[key] !== normalizedExistingFields[key]) {
        allValuesMatch = false;
        break;
      }
    }

    if (allValuesMatch) {
      return true; // Found an exact duplicate
    }
  }

  return false; // No duplicate found
}

export const POST = withCSRFProtection(async (request: NextRequest) => {
  try {
    const session = await requireAuth();
    const { games, customColumns, columnMapping } = await request.json();

    if (!games || !Array.isArray(games)) {
      return NextResponse.json({ success: false, error: "Invalid games data" }, { status: 400 });
    }

    let successCount = 0;
    let failedCount = 0;
    let duplicateCount = 0;
    const errors: string[] = [];
    const warnings: string[] = [];
    const duplicates: string[] = [];
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
        let timeValue: string | null = null;
        let opponentName: string | null = null;

        // Find the CSV column names mapped to 'time' and 'opponent'
        const timeColumn = Object.keys(columnMapping).find((key) => columnMapping[key] === "time");
        const opponentColumn = Object.keys(columnMapping).find((key) => columnMapping[key] === "opponent");

        // Pull the values from the customFields object if the mapping exists
        if (timeColumn && gameData.customFields?.[timeColumn]) {
          const rawTimeValue = String(gameData.customFields[timeColumn]);
          try {
            // Normalize time format for Google Calendar compatibility (HH:MM with leading zeros)
            timeValue = normalizeTimeFormat(rawTimeValue);
            // Also update the customFields with normalized time
            if (timeValue) {
              gameData.customFields[timeColumn] = timeValue;
            }
          } catch (error) {
            // Log warning but don't fail the import - time is optional
            const message = error instanceof Error ? error.message : "Invalid time format";
            warnings.push(`Row ${rowNum}: ${message} for time "${rawTimeValue}". Time set to empty.`);
            timeValue = null;
            gameData.customFields[timeColumn] = null;
          }
        }

        if (opponentColumn && gameData.customFields?.[opponentColumn]) {
          opponentName = String(gameData.customFields[opponentColumn]);
        }

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
          errors.push(`Row ${rowNum}: ${dateError instanceof Error ? dateError.message : "Invalid date"}`);
          failedCount++;
          continue;
        }

        // === CHECK FOR DUPLICATE ROW ===
        const isDuplicate = await isDuplicateRow(
          parsedDate,
          gameData.customFields || {},
          session.user.organizationId
        );

        if (isDuplicate) {
          duplicates.push(`Row ${rowNum}: Duplicate row detected (all fields match existing game)`);
          duplicateCount++;
          continue; // Skip this row
        }

        // === CREATE GAME WITH DATE AND CUSTOM FIELDS ===
        const gameCreateData = {
          date: parsedDate,
          homeTeamId: defaultTeam.id,
          isHome: true, // Default value
          status: "SCHEDULED" as GameStatus,
          customFields: gameData.customFields || {},
          createdById: session.user.id,
          time: timeValue,
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
        // Check if user already has imported columns
        const existingPreference = await prisma.tablePreference.findUnique({
          where: {
            userId_tableKey: {
              userId: session.user.id,
              tableKey: "games",
            },
          },
        });

        let finalCustomColumns = customColumns;
        let finalColumnMapping = columnMapping;

        // If user already has imported columns, merge them instead of replacing
        if (existingPreference?.preferences) {
          const existingPrefs = existingPreference.preferences as any;
          const existingCustomColumns = existingPrefs.customColumns as string[] | undefined;
          const existingColumnMapping = existingPrefs.columnMapping as Record<string, string> | undefined;

          if (existingCustomColumns && Array.isArray(existingCustomColumns) && existingCustomColumns.length > 0) {
            console.log(`[Import] Merging new columns with existing imported columns for user ${session.user.id}`);

            // Merge columns: Add new columns that don't already exist
            const existingColumnSet = new Set(existingCustomColumns);
            const newUniqueColumns = customColumns.filter((col: string) => !existingColumnSet.has(col));
            finalCustomColumns = [...existingCustomColumns, ...newUniqueColumns];

            // Merge column mappings
            finalColumnMapping = {
              ...(existingColumnMapping || {}),
              ...columnMapping,
            };

            console.log(`[Import] Added ${newUniqueColumns.length} new columns. Total columns: ${finalCustomColumns.length}`);
          } else {
            console.log(`[Import] First import - replacing default columns for user ${session.user.id}`);
          }
        } else {
          console.log(`[Import] First import - creating custom column configuration for user ${session.user.id}`);
        }

        // CRITICAL FIX: When saving imported columns, also reset column order and hidden columns
        // to ensure default columns don't show alongside imported columns
        const importedColumnIds = finalCustomColumns
          .filter((colName: string) => {
            const mapping = finalColumnMapping[colName];
            return mapping && mapping !== "skip";
          })
          .map((colName: string) => `imported:${colName}`);

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
              customColumns: finalCustomColumns,
              columnMapping: finalColumnMapping,
              importedAt: new Date().toISOString(),
              order: [...importedColumnIds, "actions"], // Set order to ONLY imported columns + actions
              hidden: [], // Clear any hidden columns
            },
          },
          update: {
            preferences: {
              customColumns: finalCustomColumns,
              columnMapping: finalColumnMapping,
              importedAt: new Date().toISOString(),
              order: [...importedColumnIds, "actions"], // Reset order to ONLY imported columns + actions
              hidden: [], // Clear any hidden columns
            },
          },
        });
        console.log(`[Import] Saved custom column configuration for user ${session.user.id}`);
      } catch (prefError) {
        console.error("[Import] Failed to save column preferences:", prefError);
        // Don't fail the import if preference saving fails
      }
    }

    // Detect and create opponents in the background (after successful import)
    if (successCount > 0 && customColumns) {
      try {
        const detectionResult = await detectAndCreateOpponents(customColumns, games, session.user.organizationId);

        if (detectionResult.detected) {
          console.log(`[Import] Opponent detection: Created ${detectionResult.opponentsCreated} opponents from column "${detectionResult.columnName}"`);
          if (detectionResult.errors && detectionResult.errors.length > 0) {
            console.warn(`[Import] Opponent detection warnings:`, detectionResult.errors);
          }
        } else {
          console.log("[Import] No opponent column detected or no opponents created");
        }
      } catch (opponentError) {
        console.error("[Import] Opponent detection failed (non-blocking):", opponentError);
        // Don't fail the import if opponent detection fails
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        success: successCount,
        failed: failedCount,
        duplicates: duplicateCount,
        errors,
        warnings,
        duplicateDetails: duplicates,
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
});
