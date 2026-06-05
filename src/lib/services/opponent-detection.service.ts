import { prisma } from "@/lib/database/prisma";

/**
 * Opponent Detection Service
 * 
 * Automatically detects and creates opponents from imported CSV data.
 * Matches column names against known opponent-related terms and extracts
 * unique text values > 4 characters to create opponent records.
 */

const OPPONENT_KEYWORDS = [
  "away", "away team", "away teams", "away school", "away schools",
  "opponent", "opponents", "opponent team", "opposing team", "opposing school",
  "rival", "rivals", "other team", "other teams", "other school",
  "challenger", "challengers", "visiting team", "visiting school",
  "visitor", "visitors", "visiting", "competition", "competing team",
  "competition team", "adversary", "guest", "guests", "guest team",
  "playing against", "their team", "the other team",
  "contender", "contenders", "ops", "fuckboys", "nerds", "dumbasses", "losers",
];

const OPPONENT_KEYWORDS_EXACT_ONLY = ["vs", "vs.", "v.s.", "opp", "foe", "foes", "matchup", "enemy"];

interface OpponentDetectionResult {
  detected: boolean;
  columnName?: string;
  opponentsCreated: number;
  errors?: string[];
}

interface ImportGameData {
  customFields?: Record<string, any>;
}

/**
 * Detects opponent column and creates opponent records from imported games
 * 
 * @param customColumns - Array of column names from CSV import
 * @param games - Array of imported game data
 * @param organizationId - Organization ID to create opponents for
 * @returns Detection result with count of opponents created
 */
export async function detectAndCreateOpponents(
  customColumns: string[] | undefined,
  games: ImportGameData[],
  organizationId: string
): Promise<OpponentDetectionResult> {
  try {
    // Fail gracefully if no custom columns provided
    if (!customColumns || customColumns.length === 0) {
      console.log("[OpponentDetection] No custom columns provided, skipping detection");
      return { detected: false, opponentsCreated: 0 };
    }

    // Detect opponent column (case-insensitive match)
    const opponentColumnName = customColumns.find((col) => {
      const norm = col.toLowerCase().trim();
      // exact match against all keywords
      if ([...OPPONENT_KEYWORDS, ...OPPONENT_KEYWORDS_EXACT_ONLY].some((k) => norm === k)) return true;
      // partial/contains match only for longer keywords (avoids false positives for short ones)
      if (OPPONENT_KEYWORDS.some((k) => norm.includes(k))) return true;
      return false;
    });

    // Fail gracefully if no opponent column detected
    if (!opponentColumnName) {
      console.log("[OpponentDetection] No opponent column detected in import");
      return { detected: false, opponentsCreated: 0 };
    }

    console.log(`[OpponentDetection] Detected opponent column: "${opponentColumnName}"`);

    // Extract unique opponent names from games
    const opponentNames = new Set<string>();
    games.forEach((game) => {
      const customFields = game.customFields;
      if (customFields && customFields[opponentColumnName]) {
        const value = String(customFields[opponentColumnName]).trim();
        const valueLower = value.toLowerCase();
        
        // Only include text values >= 2 characters
        // Exclude "home" or "away" as these are placeholders, not actual opponent names
        if (value.length >= 2 && valueLower !== "home" && valueLower !== "away") {
          opponentNames.add(value);
        }
      }
    });

    if (opponentNames.size === 0) {
      console.log("[OpponentDetection] No valid opponent names found (all values < 2 characters or only 'home'/'away' placeholders)");
      return { 
        detected: true, 
        columnName: opponentColumnName, 
        opponentsCreated: 0 
      };
    }

    console.log(`[OpponentDetection] Found ${opponentNames.size} unique opponent names`);

    // Check current opponent count for organization
    const currentCount = await prisma.opponent.count({
      where: { organizationId },
    });

    const remainingSlots = 100 - currentCount;
    if (remainingSlots <= 0) {
      console.log("[OpponentDetection] Organization has reached 100 opponent limit, skipping creation");
      return {
        detected: true,
        columnName: opponentColumnName,
        opponentsCreated: 0,
        errors: ["Organization has reached maximum of 100 opponents"],
      };
    }

    // Fetch existing opponents (case-insensitive name comparison)
    const existingOpponents = await prisma.opponent.findMany({
      where: { organizationId },
      select: { name: true },
    });

    const existingNamesLower = new Set(
      existingOpponents.map((o) => o.name.toLowerCase())
    );

    // Filter out opponents that already exist
    const newOpponentNames = Array.from(opponentNames).filter(
      (name) => !existingNamesLower.has(name.toLowerCase())
    );

    if (newOpponentNames.length === 0) {
      console.log("[OpponentDetection] All opponents already exist, no new opponents to create");
      return {
        detected: true,
        columnName: opponentColumnName,
        opponentsCreated: 0,
      };
    }

    // Limit to remaining slots
    const opponentsToCreate = newOpponentNames.slice(0, remainingSlots);
    const skippedCount = newOpponentNames.length - opponentsToCreate.length;

    if (skippedCount > 0) {
      console.log(`[OpponentDetection] Limiting creation to ${opponentsToCreate.length} opponents (${skippedCount} skipped due to 100 opponent limit)`);
    }

    // Get highest sort order
    const highestSortOrder = await prisma.opponent.findFirst({
      where: { organizationId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    let nextSortOrder = (highestSortOrder?.sortOrder || 0) + 1;

    // Create opponents
    const createPromises = opponentsToCreate.map((name) => {
      const sortOrder = nextSortOrder++;
      return prisma.opponent.create({
        data: {
          name,
          organizationId,
          sortOrder,
        },
      });
    });

    await Promise.all(createPromises);

    console.log(`[OpponentDetection] Successfully created ${opponentsToCreate.length} opponents`);

    const errors = skippedCount > 0 
      ? [`${skippedCount} opponents skipped due to 100 opponent limit`]
      : undefined;

    return {
      detected: true,
      columnName: opponentColumnName,
      opponentsCreated: opponentsToCreate.length,
      errors,
    };
  } catch (error) {
    // Fail gracefully - log error but don't throw
    console.error("[OpponentDetection] Error during opponent detection:", error);
    return {
      detected: false,
      opponentsCreated: 0,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}
