/**
 * Sample Game Service
 * Handles creation and deletion of sample game data for new users
 */

import { prisma } from "@/lib/database/prisma";

interface CreateSampleGameParams {
  userId: string;
  organizationId: string;
  /** When true, creates a default "Games" workbook and assigns the sample game to it. */
  createWorkbook?: boolean;
}

/**
 * Creates a sample game for a new user with predefined data
 * Sample game includes: Girls Basketball, Varsity, Westchester Giants, Home, 12:00 PM, Pending
 */
export async function createSampleGame(params: CreateSampleGameParams): Promise<void> {
  const { userId, organizationId, createWorkbook = false } = params;

  try {
    // Find or create "Girls Basketball" sport
    let sport = await prisma.sport.findFirst({
      where: { name: "Girls Basketball" },
    });

    if (!sport) {
      sport = await prisma.sport.create({
        data: {
          name: "Girls Basketball",
          season: "WINTER",
        },
      });
    }

    // Find or create "Girls Basketball Varsity" team
    let team = await prisma.team.findFirst({
      where: {
        organizationId,
        sportId: sport.id,
        level: "VARSITY",
      },
    });

    if (!team) {
      team = await prisma.team.create({
        data: {
          name: "Girls Basketball Varsity",
          level: "VARSITY",
          sportId: sport.id,
          organizationId,
        },
      });
    }

    // Find or create "Westchester Giants" opponent
    let opponent = await prisma.opponent.findFirst({
      where: {
        organizationId,
        name: "Westchester Giants",
      },
    });

    if (!opponent) {
      opponent = await prisma.opponent.create({
        data: {
          name: "Westchester Giants",
          organizationId,
        },
      });
    }

    // Optionally create the default "Games" workbook upfront so the sample game
    // is assigned to it immediately — avoids the client-side race where the
    // auto-create fires before this game exists and assignOrphans finds nothing.
    let workbookId: string | undefined;
    if (createWorkbook) {
      const existing = await prisma.gamesWorkbook.findFirst({
        where: { userId },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      });

      if (existing) {
        workbookId = existing.id;
      } else {
        const wb = await prisma.gamesWorkbook.create({
          data: { name: "Games", sortOrder: 0, userId },
        });
        workbookId = wb.id;
      }
    }

    // Create the sample game with today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.game.create({
      data: {
        date: today,
        time: "12:00",
        status: "SCHEDULED",
        notes: "Bring food and drinks!",
        isHome: true,
        homeTeamId: team.id,
        opponentId: opponent.id,
        createdById: userId,
        isSampleGame: true,
        busTravel: false,
        ...(workbookId ? { workbookId } : {}),
      },
    });

    console.log(`[Sample Game] Created sample game for user ${userId}`);
  } catch (error) {
    console.error(`[Sample Game] Failed to create sample game for user ${userId}:`, error);
    // Don't throw - sample game creation failure shouldn't block signup
  }
}

/**
 * Deletes all sample games for a specific user
 */
export async function deleteSampleGames(userId: string): Promise<number> {
  try {
    const result = await prisma.game.deleteMany({
      where: {
        createdById: userId,
        isSampleGame: true,
      },
    });

    console.log(`[Sample Game] Deleted ${result.count} sample game(s) for user ${userId}`);
    return result.count;
  } catch (error) {
    console.error(`[Sample Game] Failed to delete sample games for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Checks if a user has any sample games
 */
export async function hasSampleGames(userId: string): Promise<boolean> {
  try {
    const count = await prisma.game.count({
      where: {
        createdById: userId,
        isSampleGame: true,
      },
    });

    return count > 0;
  } catch (error) {
    console.error(`[Sample Game] Failed to check sample games for user ${userId}:`, error);
    return false;
  }
}
