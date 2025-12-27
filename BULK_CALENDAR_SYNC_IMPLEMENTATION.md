# Bulk Calendar Sync Implementation

## Overview
Implemented a bulk calendar sync feature that allows users to select multiple games in the GamesTable and sync them all to Google Calendar with a single click.

## Features Implemented

### 1. Bulk Sync Mutation
**Location**: `/src/components/games/GamesTable.tsx` (lines 2021-2114)

- Syncs games sequentially to avoid Google Calendar API rate limiting
- Tracks three result states:
  - **Successful**: Games that synced successfully
  - **Failed**: Games that failed to sync with error messages
  - **Skipped**: Games skipped due to no Google Calendar connection
- Shows initial "Syncing X games..." notification
- Updates query cache optimistically with synced status
- Builds detailed result notification showing counts for each state
- Clears selections after sync completes
- Uses existing `/api/games/[id]/gsync-calendar` endpoint

### 2. Calendar Mappings Handling
The implementation automatically handles calendar group mappings:
- Uses existing `syncGameToCalendar` function
- Calls `resolveCalendarId` to check calendar group mappings
- Syncs to appropriate calendar based on:
  - Sport (e.g., "Basketball")
  - Level (e.g., "Varsity", "Junior Varsity")
  - Team (e.g., "Boys Varsity Basketball")
  - Custom fields from CSV imports
- Falls back to primary calendar if no mapping matches

### 3. UI Button
**Location**: `/src/components/games/GamesTable.tsx` (lines 6636-6656)

- IconButton with Sync icon
- Positioned next to the Copy button in the toolbar
- Tooltip: "Sync calendars"
- Shows CircularProgress spinner while syncing
- Only visible when games are selected
- Disabled during sync operation

### 4. Handler Function
**Location**: `/src/components/games/GamesTable.tsx` (lines 3336-3345)

```typescript
const handleBulkSync = () => {
  const count = selectedGames.size;
  if (count === 0) return;
  const selectedIds = Array.from(selectedGames);
  bulkSyncGamesMutation.mutate(selectedIds);
};
```

## User Experience

### Notification Messages
- **Start**: "Syncing X game(s) to Google Calendar..."
- **Success**: "✓ X game(s) synced successfully"
- **Partial Success**: "✓ X synced successfully. ✗ Y failed"
- **Skipped**: "⊘ X skipped (Google Calendar not connected)"
- **Notification Type**: 
  - Success (all succeed)
  - Warning (some fail)
  - Error (all skip/fail)

### Button States
1. **Initial**: Sync icon, enabled
2. **Syncing**: CircularProgress spinner, disabled
3. **Complete**: Returns to initial state (selections cleared)

## Technical Details

### Sequential Sync Pattern
Games are synced one at a time to avoid overwhelming the Google Calendar API:

```typescript
for (const gameId of gameIds) {
  try {
    const res = await fetch(`/api/games/${gameId}/gsync-calendar`, { 
      method: "POST" 
    });
    // Handle response...
  } catch (error) {
    // Track error...
  }
}
```

### Cache Updates
The mutation optimistically updates the query cache for successful syncs:

```typescript
const updateGame = (g: Game) => {
  if (results.successful.includes(g.id)) {
    return { ...g, calendarSynced: true };
  }
  return g;
};
```

### Error Handling
- Checks for `skipped` flag from API (no calendar connection)
- Tracks individual game errors with gameId and error message
- Shows aggregate results to user
- Doesn't interrupt sync process if one game fails

## Files Modified
- `/src/components/games/GamesTable.tsx`
  - Lines 2021-2114: `bulkSyncGamesMutation`
  - Lines 3336-3345: `handleBulkSync` handler
  - Lines 6636-6656: Sync button UI

## Testing Checklist
- [x] Button only shows when games are selected
- [x] Button positioned next to Copy button
- [x] Tooltip displays "Sync calendars"
- [x] Loading spinner shows during sync
- [x] Notification shows progress and results
- [x] Calendar mappings are respected
- [x] Selections cleared after sync
- [x] Error handling for failed syncs
- [x] Graceful handling when calendar not connected
- [x] Sequential sync to avoid rate limiting

## Benefits
1. **Efficiency**: Sync multiple games with one click instead of syncing individually
2. **Clear Feedback**: Detailed notifications show exactly what succeeded and failed
3. **Mapping Support**: Automatically uses calendar group mappings for each game
4. **Error Handling**: Gracefully handles failures without stopping the entire process
5. **Rate Limiting Protection**: Sequential sync prevents overwhelming the Google Calendar API
6. **User Control**: Clear visual indication of which games are selected for sync
