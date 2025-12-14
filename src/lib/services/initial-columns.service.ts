/**
 * Initial Columns Service
 * 
 * Creates default column preferences for new users to provide a clean,
 * focused onboarding experience with only essential columns visible.
 */

import { prisma } from "@/lib/database/prisma";

/**
 * Default visible columns for new users (5 columns)
 * - Date: Essential for scheduling
 * - Sport: What sport is being played
 * - Level: What level (Varsity, JV, etc.)
 * - Location: Where the game is
 * - Actions: Required for CRUD operations
 */
const DEFAULT_VISIBLE_COLUMNS = ["date", "sport", "level", "location", "actions"];

/**
 * All available default columns
 * Hidden columns can be revealed via Column Preferences menu
 */
const ALL_DEFAULT_COLUMNS = [
  "date",
  "sport",
  "level",
  "opponent",
  "isHome",
  "time",
  "status",
  "location",
  "busTravel",
  "notes",
  "actions",
];

/**
 * Columns to hide by default for new users
 */
const DEFAULT_HIDDEN_COLUMNS = ALL_DEFAULT_COLUMNS.filter(
  (col) => !DEFAULT_VISIBLE_COLUMNS.includes(col)
);

/**
 * Creates initial column preferences for a new user
 * This runs in the background during signup to prepare the GamesTable
 * with a clean, minimal set of columns
 */
export async function createInitialColumnPreferences(userId: string): Promise<void> {
  try {
    // Check if user already has preferences (shouldn't happen, but safety check)
    const existing = await prisma.tablePreference.findUnique({
      where: {
        userId_tableKey: {
          userId,
          tableKey: "games",
        },
      },
    });

    if (existing) {
      console.log(`[InitialColumns] User ${userId} already has column preferences, skipping`);
      return;
    }

    // Create preferences with default visible columns
    await prisma.tablePreference.create({
      data: {
        userId,
        tableKey: "games",
        preferences: {
          order: DEFAULT_VISIBLE_COLUMNS,
          hidden: DEFAULT_HIDDEN_COLUMNS,
        },
      },
    });

    console.log(`[InitialColumns] Created default column preferences for user ${userId}`);
  } catch (error) {
    console.error(`[InitialColumns] Failed to create column preferences for user ${userId}:`, error);
    // Don't throw - this is a non-critical operation
  }
}
