# Google Calendar Sync Tracker

## Overview
The Google Calendar Sync Tracker is a simple database-based tracker that monitors how many users have actively synced their Google Calendars with the Opletics application.

## Database Schema

### Table: `GoogleCalendarSyncTracker`
```prisma
model GoogleCalendarSyncTracker {
  id            String   @id @default(cuid())
  count         Int      @default(0)
  lastUpdated   DateTime @updatedAt
  lastCountedAt DateTime @default(now())
}
```

**Fields:**
- `id`: Primary key (defaults to "default" when using the service)
- `count`: The number of users with actively synced calendars
- `lastUpdated`: Timestamp of the last update to this record (automatically managed by Prisma)
- `lastCountedAt`: Timestamp when the count was last recalculated

## How It Works

### Definition of "Actively Synced"
A user is considered to have an actively synced calendar if they meet **both** criteria:

1. **Has Google Calendar tokens**: The user must have either:
   - A valid refresh token or access token in the `Account` table (provider: "google")
   - OR legacy tokens in `User` fields (`googleCalendarRefreshToken` or `googleCalendarAccessToken`)

2. **Has at least one synced game**: The user must have at least one game with `calendarSynced: true`

## Service: `CalendarSyncTrackerService`

### Methods

#### `getSyncedUserCount(): Promise<number>`
Returns the current cached count of users with actively synced calendars.

**Example:**
```typescript
import { calendarSyncTrackerService } from "@/lib/services/calendar-sync-tracker.service";

const count = await calendarSyncTrackerService.getSyncedUserCount();
console.log(`${count} users have actively synced calendars`);
```

#### `recalculateSyncedUserCount(): Promise<number>`
Recalculates the count by querying the database and updates the tracker record.

**Example:**
```typescript
const accurateCount = await calendarSyncTrackerService.recalculateSyncedUserCount();
```

This is useful if the tracker gets out of sync due to:
- Manual database changes
- Data migrations
- Bugs or system failures

#### `incrementSyncedUserCount(): Promise<void>`
Increments the count by 1. This is automatically called when a user syncs their first game.

#### `decrementSyncedUserCount(): Promise<void>`
Decrements the count by 1. This is automatically called when a user's last synced game is unsynced.

#### `isNewSyncUser(userId: string): Promise<boolean>`
Checks if a user has no currently synced games. Returns `true` if this is their first sync.

#### `hasNoMoreSyncedGames(userId: string): Promise<boolean>`
Checks if a user has no more synced games (all games unsynced). Returns `true` if this was their last synced game.

## Automatic Tracking

The tracker is automatically integrated into the `CalendarService`:

### On Game Sync (`syncGameToCalendar`)
1. Before syncing, checks if this is the user's first synced game
2. If `isNewSyncUser()` returns `true`, increments the tracker count after successful sync

### On Game Unsync (`unsyncGame`)
1. After unsyncing, checks if the user has any remaining synced games
2. If `hasNoMoreSyncedGames()` returns `true`, decrements the tracker count

## API Endpoint

### `GET /api/calendar-sync-tracker`

Returns the current count of users with actively synced calendars.

**Query Parameters:**
- `recalculate` (optional): Set to `"true"` to force a recalculation before returning the count

**Response:**
```json
{
  "success": true,
  "data": {
    "syncedUsers": 42,
    "timestamp": "2025-01-11T15:30:00.000Z"
  }
}
```

**Examples:**

Get current count (cached):
```bash
curl http://localhost:3000/api/calendar-sync-tracker
```

Force recalculation:
```bash
curl http://localhost:3000/api/calendar-sync-tracker?recalculate=true
```

## Usage Examples

### In a Dashboard/Analytics Page
```typescript
"use client";

import { useEffect, useState } from "react";

export function CalendarSyncStats() {
  const [syncedUsers, setSyncedUsers] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch("/api/calendar-sync-tracker");
        const data = await response.json();
        if (data.success) {
          setSyncedUsers(data.data.syncedUsers);
        }
      } catch (error) {
        console.error("Failed to fetch sync stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="stat-card">
      <h3>Google Calendar Sync</h3>
      <p className="stat-value">{syncedUsers}</p>
      <p className="stat-label">Users with active sync</p>
    </div>
  );
}
```

### In a Cron Job (Periodic Recalculation)
```typescript
import { calendarSyncTrackerService } from "@/lib/services/calendar-sync-tracker.service";

export async function recalculateTracker() {
  console.log("Recalculating Google Calendar Sync Tracker...");

  try {
    const count = await calendarSyncTrackerService.recalculateSyncedUserCount();
    console.log(`Recalculated count: ${count} users`);

    return { success: true, count };
  } catch (error) {
    console.error("Failed to recalculate tracker:", error);
    return { success: false, error };
  }
}

// Call this periodically (e.g., via Vercel Cron or a scheduled job)
// Example: Run every day at midnight
```

## Maintenance

### When to Recalculate
Consider running `recalculateSyncedUserCount()` if:
- You manually modify the database (e.g., change `calendarSynced` flags)
- You import/export data
- You notice the count seems incorrect

### Monitoring
The tracker has built-in logging. Check your logs for messages like:
- `[CalendarSyncTracker] Recalculated synced user count: X`
- `[CalendarSyncTracker] Incremented synced user count`
- `[CalendarSyncTracker] Decremented synced user count`

## Integration Points

The tracker automatically updates when:

1. **Games are synced** via `CalendarService.syncGameToCalendar()`
2. **Games are unsynced** via `CalendarService.unsyncGame()`
3. **Games are created/updated** with `calendarSynced` flag (if you set this manually elsewhere, you'll need to update the tracker too)

## Notes

- The tracker uses a single-row table with `id = "default"` (created automatically by the service)
- The count is optimistic/incremental for performance, but can be recalculated for accuracy
- The `lastCountedAt` field tracks when the last full recalculation occurred
- The `lastUpdated` field tracks when the count was last modified (increment/decrement)
