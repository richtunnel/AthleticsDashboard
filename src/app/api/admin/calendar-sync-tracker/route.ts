import { NextRequest, NextResponse } from "next/server";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";
import { calendarSyncTrackerService } from "@/lib/services/calendar-sync-tracker.service";
import { prisma } from "@/lib/database/prisma";

/**
 * Admin endpoint for Google Calendar Sync Tracker statistics
 * This provides more detailed information about calendar sync usage
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const recalculate = searchParams.get("recalculate") === "true";

    // Get the current synced user count
    let syncedUserCount: number;
    if (recalculate) {
      syncedUserCount = await calendarSyncTrackerService.recalculateSyncedUserCount();
    } else {
      syncedUserCount = await calendarSyncTrackerService.getSyncedUserCount();
    }

    // Get additional statistics
    const [totalUsers, usersWithGoogleAuth, totalSyncedGames] = await Promise.all([
      // Total users in the system
      prisma.user.count({ where: { isDisabled: false } }),
      // Users who have connected Google Calendar (have tokens)
      prisma.user.count({
        where: {
          OR: [
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
            {
              OR: [
                { googleCalendarRefreshToken: { not: null } },
                { googleCalendarAccessToken: { not: null } },
              ],
            },
          ],
        },
      }),
      // Total synced games
      prisma.game.count({
        where: { calendarSynced: true },
      }),
    ]);

    // Get tracker record for timestamps
    const tracker = await prisma.googleCalendarSyncTracker.findFirst({
      select: {
        lastCountedAt: true,
        lastUpdated: true,
      },
    });

    return ApiResponse.success({
      syncedUsers: syncedUserCount,
      totalUsers,
      usersWithGoogleAuth,
      totalSyncedGames,
      syncRate: totalUsers > 0 ? ((syncedUserCount / totalUsers) * 100).toFixed(2) + "%" : "0%",
      lastRecalculated: tracker?.lastCountedAt || null,
      lastUpdated: tracker?.lastUpdated || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return await handleApiError(error);
  }
}
