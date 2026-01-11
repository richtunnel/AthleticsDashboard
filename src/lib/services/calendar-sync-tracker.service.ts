import { prisma } from "../database/prisma";

export class CalendarSyncTrackerService {
  /**
   * Get the current count of users with actively synced Google calendars
   */
  async getSyncedUserCount(): Promise<number> {
    try {
      const tracker = await prisma.googleCalendarSyncTracker.findFirst({
        select: { count: true, lastCountedAt: true },
      });

      // If no tracker exists, return 0 (or we could initialize it)
      if (!tracker) {
        return 0;
      }

      return tracker.count;
    } catch (error) {
      console.error("[CalendarSyncTracker] Error getting synced user count:", error);
      return 0;
    }
  }

  /**
   * Recalculate and update the count of users with actively synced calendars
   * A user is considered to have an actively synced calendar if they have:
   * - A valid refresh token OR access token (from Account table or User fields)
   * - At least one game with calendarSynced: true
   */
  async recalculateSyncedUserCount(): Promise<number> {
    try {
      // Count users who have:
      // 1. Google Calendar tokens (either from Account table or User fields)
      // 2. At least one game with calendarSynced: true

      const usersWithActiveSync = await prisma.user.count({
        where: {
          AND: [
            {
              OR: [
                // Has Google refresh token in Account table
                {
                  accounts: {
                    some: {
                      provider: "google",
                      OR: [
                        { refresh_token: { not: null } },
                        { access_token: { not: null } },
                      ],
                    },
                  },
                },
                // Or has tokens in User fields (legacy support)
                {
                  OR: [
                    { googleCalendarRefreshToken: { not: null } },
                    { googleCalendarAccessToken: { not: null } },
                  ],
                },
              ],
            },
            // Has at least one synced game
            {
              games: {
                some: {
                  calendarSynced: true,
                },
              },
            },
          ],
        },
      });

      // Update or create the tracker record
      const tracker = await prisma.googleCalendarSyncTracker.upsert({
        where: { id: "default" },
        update: {
          count: usersWithActiveSync,
          lastCountedAt: new Date(),
        },
        create: {
          id: "default",
          count: usersWithActiveSync,
          lastCountedAt: new Date(),
        },
      });

      console.log(`[CalendarSyncTracker] Recalculated synced user count: ${usersWithActiveSync}`);
      return tracker.count;
    } catch (error) {
      console.error("[CalendarSyncTracker] Error recalculating synced user count:", error);
      throw error;
    }
  }

  /**
   * Increment the count when a user syncs their first game
   */
  async incrementSyncedUserCount(): Promise<void> {
    try {
      const tracker = await prisma.googleCalendarSyncTracker.findFirst({
        select: { id: true, count: true },
      });

      if (tracker) {
        await prisma.googleCalendarSyncTracker.update({
          where: { id: tracker.id },
          data: {
            count: { increment: 1 },
          },
        });
      } else {
        // Create tracker if it doesn't exist
        await prisma.googleCalendarSyncTracker.create({
          data: {
            id: "default",
            count: 1,
            lastCountedAt: new Date(),
          },
        });
      }

      console.log("[CalendarSyncTracker] Incremented synced user count");
    } catch (error) {
      console.error("[CalendarSyncTracker] Error incrementing synced user count:", error);
      throw error;
    }
  }

  /**
   * Decrement the count when a user's last synced game is unsynced
   */
  async decrementSyncedUserCount(): Promise<void> {
    try {
      const tracker = await prisma.googleCalendarSyncTracker.findFirst({
        select: { id: true, count: true },
      });

      if (!tracker || tracker.count <= 0) {
        return; // Don't go below zero
      }

      await prisma.googleCalendarSyncTracker.update({
        where: { id: tracker.id },
        data: {
          count: { decrement: 1 },
        },
      });

      console.log("[CalendarSyncTracker] Decremented synced user count");
    } catch (error) {
      console.error("[CalendarSyncTracker] Error decrementing synced user count:", error);
      throw error;
    }
  }

  /**
   * Check if a user is newly syncing (this is their first synced game)
   * Returns true if the user had no synced games before this one
   */
  async isNewSyncUser(userId: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
        },
      });

      if (!user) {
        return false;
      }

      const syncedGameCount = await prisma.game.count({
        where: {
          createdById: userId,
          calendarSynced: true,
        },
      });

      return syncedGameCount === 0;
    } catch (error) {
      console.error("[CalendarSyncTracker] Error checking if user is new sync:", error);
      return false;
    }
  }

  /**
   * Check if a user has no more synced games (all games unsynced)
   * Returns true if this was the user's last synced game
   */
  async hasNoMoreSyncedGames(userId: string): Promise<boolean> {
    try {
      const syncedGameCount = await prisma.game.count({
        where: {
          createdById: userId,
          calendarSynced: true,
        },
      });

      return syncedGameCount === 0;
    } catch (error) {
      console.error("[CalendarSyncTracker] Error checking if user has no more synced games:", error);
      return false;
    }
  }
}

export const calendarSyncTrackerService = new CalendarSyncTrackerService();
