import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import { GameStatus } from "../../../../../../types/main.types";
import { deleteSampleGames } from "@/lib/services/sample-game.service";
import { detectAndCreateOpponents } from "@/lib/services/opponent-detection.service";
import { normalizeTimeFormat } from "@/lib/utils/timeValidation";
import { sanitizeCustomFields, sanitizeColumnName } from "@/lib/utils/sanitizer";

interface ImportGameData {
  date: string;
  customFields?: Record<string, any>; // All non-date columns stored here
}

// ── Home/Away smart detection ─────────────────────────────────────────────────
// Column names that typically hold the home/away indicator
const HOME_AWAY_COL_NAMES = new Set([
  "home", "away", "homeaway", "home/away", "h/a", "ha", "ishome",
  "location type", "locationtype", "game type", "gametype", "type",
  "site", "host", "venue type", "venuetype", "field", "status type",
  "home or away", "home_away", "location_type",
]);

// Values that indicate HOME
const HOME_VALUES = new Set([
  "home", "h", "hm", "home game", "at home", "host", "hosting",
  "home field", "home venue", "home team", "1", "true", "yes",
]);

// Values that indicate AWAY
const AWAY_VALUES = new Set([
  "away", "a", "aw", "away game", "on the road", "road game", "visiting",
  "visitor", "visit", "travel", "travels", "at", "0", "false", "no",
]);

/**
 * Infers whether the AD's team is playing at home from a CSV game row.
 * Returns:
 *   true  → home game
 *   false → away game
 *   null  → could not determine (caller should default to true)
 */
function detectIsHome(customFields: Record<string, any>): boolean | null {
  if (!customFields || typeof customFields !== "object") return null;

  // Phase 1: check well-known column names first (case-insensitive key lookup)
  for (const [rawKey, val] of Object.entries(customFields)) {
    const normKey = rawKey.trim().toLowerCase().replace(/\s+/g, " ");
    if (!HOME_AWAY_COL_NAMES.has(normKey)) continue;

    const normVal = String(val ?? "").trim().toLowerCase();
    if (!normVal) continue;

    if (HOME_VALUES.has(normVal))  return true;
    if (AWAY_VALUES.has(normVal))  return false;

    // Partial match for values like "home – varsity" or "away (jv)"
    if (/\bhome\b/i.test(normVal))  return true;
    if (/\baway\b/i.test(normVal))  return false;
    if (/^h$/i.test(normVal))       return true;
    if (/^a$/i.test(normVal))       return false;
  }

  // Phase 2: scan ALL values for unambiguous home/away signals when no
  //          dedicated column was found — handles CSVs where the location
  //          column is simply called "Location" with values "Home" or "Away"
  for (const [, val] of Object.entries(customFields)) {
    const normVal = String(val ?? "").trim().toLowerCase();
    if (!normVal || normVal.length > 40) continue; // skip long text (notes etc.)

    if (HOME_VALUES.has(normVal))  return true;
    if (AWAY_VALUES.has(normVal))  return false;
  }

  return null; // undetermined
}

// Helper function to validate date string
function validateAndParseDate(dateString: string): Date {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateString}`);
  }
  return date;
}

// Helper function to create a signature for duplicate detection within batch
function createGameSignature(date: Date, customFields: Record<string, any>): string {
  // Normalize custom fields for comparison (same logic as in isDuplicateRow)
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

  const normalizedFields = normalizeFields(customFields);
  const dateStr = date.toISOString().split("T")[0];
  const keys = Object.keys(normalizedFields).sort();
  const values = keys.map(key => normalizedFields[key]);
  
  return JSON.stringify({ date: dateStr, keys, values });
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
  organizationId: string,
  batchGameSignatures: Set<string> = new Set()
): Promise<boolean> {
  // Check for duplicates within current batch first
  const gameSignature = createGameSignature(date, customFields);
  if (batchGameSignatures.has(gameSignature)) {
    return true; // Duplicate found within current batch
  }

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

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { games, customColumns, columnMapping, workbookId } = await request.json();

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

    // ── Pre-load existing games for the entire import date range ─────────────
    // Eliminates the per-row isDuplicateRow DB query (was O(n), now O(1)).
    const parsedDates: Date[] = [];
    for (const g of games as ImportGameData[]) {
      try { parsedDates.push(validateAndParseDate(g.date)); } catch { /* invalid dates caught below */ }
    }
    const existingSignatures = new Set<string>();
    if (parsedDates.length > 0) {
      const minDate = new Date(Math.min(...parsedDates.map((d) => d.getTime())));
      const maxDate = new Date(Math.max(...parsedDates.map((d) => d.getTime())));
      minDate.setUTCHours(0, 0, 0, 0);
      maxDate.setUTCHours(23, 59, 59, 999);

      // Scope duplicate detection to THIS worksheet only. Each worksheet is an
      // isolated table (games are stored with their workbookId), so the same
      // spreadsheet can be imported into a different worksheet without every row
      // being flagged as a duplicate. Duplicates are only rejected within the
      // same worksheet. (workbookId === undefined/null => the default "games"
      // worksheet, whose games also have workbookId = null.)
      const existing = await prisma.game.findMany({
        where: {
          homeTeam: { organizationId: session.user.organizationId },
          workbookId: workbookId ?? null,
          date: { gte: minDate, lte: maxDate },
        },
        select: { customFields: true, date: true },
      });
      for (const eg of existing) {
        existingSignatures.add(createGameSignature(eg.date, eg.customFields as Record<string, any> ?? {}));
      }
    }

    // Track games in current batch to avoid in-batch duplicates
    const batchGameSignatures: Set<string> = new Set();
    // Accumulate valid rows for a single bulk insert at the end
    const pendingGames: Array<{ rowNum: number; data: any }> = [];

    // Validate organization exists before proceeding
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { id: true, name: true },
    });

    if (!organization) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Organization not found. Please try signing out and back in." 
        },
        { status: 400 }
      );
    }

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

      try {
        // Create default team with proper error handling
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
      } catch (teamCreateError) {
        console.error("Failed to create default team:", teamCreateError);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to create default team. Please ensure your organization is properly set up and try again.",
            details: teamCreateError instanceof Error ? teamCreateError.message : "Unknown error",
          },
          { status: 500 }
        );
      }
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

        // === SANITIZE CUSTOM FIELDS TO PREVENT INJECTION ATTACKS ===
        const sanitizedCustomFields = sanitizeCustomFields(gameData.customFields || {});

        // === CHECK FOR DUPLICATE ROW (in-memory — no DB query per row) ===
        const gameSignature = createGameSignature(parsedDate, sanitizedCustomFields);
        if (batchGameSignatures.has(gameSignature) || existingSignatures.has(gameSignature)) {
          duplicates.push(`Row ${rowNum}: Duplicate row detected (all fields match existing game)`);
          duplicateCount++;
          continue;
        }

        // Queue for batch insert
        const detectedIsHome = detectIsHome(sanitizedCustomFields);
        pendingGames.push({
          rowNum,
          data: {
            date: parsedDate,
            homeTeamId: defaultTeam.id,
            isHome: detectedIsHome ?? true, // default to home when undetectable
            status: "SCHEDULED" as GameStatus,
            customFields: sanitizedCustomFields,
            createdById: session.user.id,
            time: timeValue,
            sortOrder: 0,
            ...(workbookId ? { workbookId } : {}),
          },
        });
        batchGameSignatures.add(gameSignature);
      } catch (error) {
        console.error(`Row ${rowNum} import error:`, error);
        errors.push(`Row ${rowNum}: ${error instanceof Error ? error.message : "Unknown error"}`);
        failedCount++;
      }
    }

    // ── Bulk insert all valid games in one DB round trip ────────────────────
    if (pendingGames.length > 0) {
      try {
        const created = await prisma.game.createManyAndReturn({
          data: pendingGames.map((p) => p.data),
          select: { id: true },
        });
        for (const row of created) createdGameIds.push(row.id);
        successCount += created.length;
      } catch (bulkErr: any) {
        // If bulk insert fails entirely, log each row as failed
        console.error("[Import] Bulk insert failed:", bulkErr);
        for (const p of pendingGames) {
          errors.push(`Row ${p.rowNum}: ${bulkErr?.message ?? "Database error during bulk insert"}`);
          failedCount++;
        }
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

    // Save custom column configuration as user preferences if provided.
    // Each worksheet import is treated as a completely isolated table — columns
    // from a previous import are NEVER merged in.  When a workbookId is present
    // we save under "games-<workbookId>" so each worksheet has its own isolated
    // column set.  The main games table uses "games" as usual.
    if (customColumns && columnMapping) {
      try {
        // Sanitize column names to prevent injection
        const sanitizedCustomColumns = customColumns.map((col: string) => sanitizeColumnName(col));
        const sanitizedColumnMapping: Record<string, string> = {};
        for (const [key, value] of Object.entries(columnMapping)) {
          const sanitizedKey = sanitizeColumnName(key);
          sanitizedColumnMapping[sanitizedKey] = typeof value === "string" ? sanitizeColumnName(value) : String(value ?? "");
        }

        // Each import is a clean slate — no merging with previous column configs.
        // For workbook-specific imports the tableKey is scoped to that workbook so
        // columns from other worksheets can never bleed in.
        const tableKey = workbookId ? `games-${workbookId}` : "games";

        const importedColumnIds = sanitizedCustomColumns
          .filter((colName: string) => {
            const mapping = sanitizedColumnMapping[colName];
            return mapping && mapping !== "skip";
          })
          .map((colName: string) => `imported:${colName}`);

        await prisma.tablePreference.upsert({
          where: {
            userId_tableKey: {
              userId: session.user.id,
              tableKey,
            },
          },
          create: {
            userId: session.user.id,
            tableKey,
            preferences: {
              customColumns: sanitizedCustomColumns,
              columnMapping: sanitizedColumnMapping,
              importedAt: new Date().toISOString(),
              order: [...importedColumnIds, "actions"],
              hidden: [],
            },
          },
          update: {
            preferences: {
              customColumns: sanitizedCustomColumns,
              columnMapping: sanitizedColumnMapping,
              importedAt: new Date().toISOString(),
              order: [...importedColumnIds, "actions"],
              hidden: [],
            },
          },
        });
        console.log(`[Import] Saved column configuration for user ${session.user.id} under tableKey "${tableKey}" (${sanitizedCustomColumns.length} columns)`);
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
}
