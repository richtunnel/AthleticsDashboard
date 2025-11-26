/**
 * Sample Game Service
 * Handles creation and deletion of sample game data for new users
 */

import { prisma } from "@/lib/database/prisma";

interface CreateSampleGameParams {
  userId: string;
  organizationId: string;
}

/**
 * Creates a sample game for a new user with predefined data
 * Sample game includes: Girls Basketball, Varsity, Westchester Giants, Home, 12:00 PM, Pending
 */
export async function createSampleGame(params: CreateSampleGameParams): Promise<void> {
  const { userId, organizationId } = params;

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

    // Create the sample game with today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to midnight

    await prisma.game.create({
      data: {
        date: today,
        time: "12:00", // 12:00 PM in HH:MM format
        status: "SCHEDULED", // "Pending" maps to SCHEDULED status
        notes: "Bring food and drinks!",
        isHome: true,
        homeTeamId: team.id,
        opponentId: opponent.id,
        createdById: userId,
        isSampleGame: true, // Mark as sample game
        busTravel: false, // No bus travel info
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
