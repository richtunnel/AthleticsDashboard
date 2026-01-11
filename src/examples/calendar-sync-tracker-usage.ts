/**
 * Example usage of Google Calendar Sync Tracker
 *
 * This file demonstrates how to use the calendar sync tracker in various scenarios.
 */

import { calendarSyncTrackerService } from "@/lib/services/calendar-sync-tracker.service";

// Example 1: Get current synced user count
export async function getSyncedUsers() {
  const count = await calendarSyncTrackerService.getSyncedUserCount();
  console.log(`Users with active calendar sync: ${count}`);
  return count;
}

// Example 2: Recalculate tracker (for admin/maintenance)
export async function recalculateTracker() {
  console.log("Recalculating calendar sync tracker...");
  const count = await calendarSyncTrackerService.recalculateSyncedUserCount();
  console.log(`Updated count: ${count} users`);
  return count;
}

// Example 3: Check if a user is new to syncing
export async function checkFirstSync(userId: string) {
  const isNewSyncUser = await calendarSyncTrackerService.isNewSyncUser(userId);
  if (isNewSyncUser) {
    console.log("User has never synced a game before");
    // The tracker will automatically increment when they sync
  } else {
    console.log("User has synced games before");
  }
}

// Example 4: Check if user has any remaining synced games
export async function checkRemainingSyncs(userId: string) {
  const hasRemaining = await calendarSyncTrackerService.hasNoMoreSyncedGames(userId);
  if (hasRemaining) {
    console.log("User has no more synced games");
    // The tracker will automatically decrement when all games are unsynced
  } else {
    console.log("User still has synced games");
  }
}

// Example 5: API call from frontend
export async function fetchTrackerFromAPI(recalculate = false) {
  const url = recalculate
    ? "/api/calendar-sync-tracker?recalculate=true"
    : "/api/calendar-sync-tracker";

  const response = await fetch(url);
  const data = await response.json();

  if (data.success) {
    console.log(`Synced users: ${data.data.syncedUsers}`);
    console.log(`Timestamp: ${data.data.timestamp}`);
    return data.data;
  }
}

// Example 6: Admin statistics (more detailed)
export async function fetchAdminStats(recalculate = false) {
  const url = recalculate
    ? "/api/admin/calendar-sync-tracker?recalculate=true"
    : "/api/admin/calendar-sync-tracker";

  const response = await fetch(url);
  const data = await response.json();

  if (data.success) {
    console.log(`Synced users: ${data.data.syncedUsers}`);
    console.log(`Total users: ${data.data.totalUsers}`);
    console.log(`Users with Google auth: ${data.data.usersWithGoogleAuth}`);
    console.log(`Total synced games: ${data.data.totalSyncedGames}`);
    console.log(`Sync rate: ${data.data.syncRate}`);
    console.log(`Last recalculated: ${data.data.lastRecalculated}`);
    return data.data;
  }
}

// Example 7: Displaying stats in a UI component
export function formatTrackerStats(data: any) {
  return {
    syncedUsers: data.syncedUsers,
    totalUsers: data.totalUsers,
    syncPercentage: data.syncRate,
    totalGamesSynced: data.totalSyncedGames,
    lastUpdated: new Date(data.lastUpdated || Date.now()).toLocaleString(),
    lastRecalculated: data.lastRecalculated
      ? new Date(data.lastRecalculated).toLocaleString()
      : "Never",
  };
}
