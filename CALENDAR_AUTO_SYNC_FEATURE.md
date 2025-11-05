# Calendar Auto-Sync Feature

## Overview
This feature allows users to toggle automatic calendar synchronization on or off while keeping manual sync always available.

## Changes Made

### 1. Database Schema Update
- Added `autoCalendarSyncEnabled` field to the `User` model in `prisma/schema.prisma`
- Default value: `false`
- Migration created: `20251105005148_add_auto_calendar_sync_enabled`

### 2. API Endpoints

#### `/api/user/calendar-auto-sync`
- **GET**: Fetches the current auto-sync setting for the authenticated user
- **PATCH**: Updates the auto-sync setting (body: `{ enabled: boolean }`)

### 3. Auto-Sync Logic

#### Game Creation (`/api/games/route.ts`)
- After a game is created, if the user has `autoCalendarSyncEnabled: true`, the game is automatically synced to Google Calendar
- Errors in auto-sync do not prevent game creation

#### Game Update (`/api/games/[id]/route.ts`)
- After a game is updated, if the user has `autoCalendarSyncEnabled: true` AND the game already has a `googleCalendarEventId`, the calendar event is updated
- Errors in auto-sync do not prevent game updates

### 4. UI Components

#### `AutoCalendarSyncToggle` Component
- Located at: `src/components/settings/AutoCalendarSyncToggle.tsx`
- Displays a toggle switch with description
- Fetches and updates the auto-sync setting via API
- Shows loading and error states

#### Settings Page Update
- Added the `AutoCalendarSyncToggle` component to the settings page
- Only visible when Google Calendar is connected
- Located in a separate section below the calendar connection status

#### Google Calendar Sync Menu Update
- Updated messaging to clarify that manual sync is always available
- Removed misleading "automatic sync" messaging when calendar is connected

## User Experience

### When Auto-Sync is OFF (default)
- Users can create and update games normally
- Manual sync button is always available in the games table
- No automatic syncing happens

### When Auto-Sync is ON
- New games are automatically synced to Google Calendar upon creation
- Updated games (that are already synced) are automatically re-synced
- Manual sync button still works for on-demand syncing

## Manual Sync
Manual sync is always available via:
- The sync button in the games table (calls `/api/games/[id]/gsync-calendar`)
- This endpoint uses the `syncGameToCalendar` method from `calendarService`

## Error Handling
- Auto-sync errors are logged but do not prevent game creation/updates
- Manual sync errors are displayed to the user via notifications
- Calendar connection status is always checked before attempting sync

## Testing Recommendations
1. Test with auto-sync OFF - verify games can be created without auto-syncing
2. Test with auto-sync ON - verify games auto-sync on creation
3. Test with auto-sync ON - verify games auto-sync on update (if already synced)
4. Test manual sync works regardless of auto-sync setting
5. Test toggling the setting in the UI
6. Test error handling when calendar is not connected
