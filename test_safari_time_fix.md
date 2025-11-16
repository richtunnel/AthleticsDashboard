# Safari Time Input Fix - Testing Guide

## Changes Made

### 1. Backend API Time Validation (`/api/games/[id]/route.ts` and `/api/games/route.ts`)
- Added time normalization: empty strings are converted to null
- Added time format validation: ensures HH:MM format (e.g., "14:30")
- Validates hours (0-23) and minutes (0-59)
- Trims whitespace from time values

### 2. Calendar Sync Service (`/lib/google/google-calendar-sync.ts`)
- Enhanced time parsing with safety checks
- Validates time format before splitting
- Checks for NaN values
- Validates hour and minute ranges
- Prevents crashes when time is invalid or empty

### 3. Frontend GamesTable Component
- Added `step: 300` (5-minute intervals) to time inputs for better mobile/Safari support
- Added `pattern: "[0-9]{2}:[0-9]{2}"` for HTML5 validation
- Improved time value normalization in inline edit handler
- Trims whitespace from time values before sending to API

## What Was Fixed

### Root Cause
Safari browser was sending empty strings or invalid time values which caused:
1. The `game.time.split(":")` to fail in calendar sync
2. Invalid time values stored in database
3. 500 errors when trying to sync to Google Calendar
4. Time showing as "TBD" even after editing

### Solution
- Backend now normalizes empty strings to `null` and validates format
- Calendar sync now safely handles any invalid time values
- Frontend ensures proper time format before sending

## Testing Checklist

### Safari Browser Tests
1. ✅ Create new game with time - should save correctly
2. ✅ Create new game without time - should show "TBD"
3. ✅ Edit time via inline edit (double-click) - should save and sync
4. ✅ Edit time via full row edit - should save and sync
5. ✅ Clear time field (make it empty) - should save as null and show "TBD"
6. ✅ Enter invalid time format - should show validation error
7. ✅ Google Calendar sync should work without 500 errors

### Chrome/Firefox Tests
1. ✅ Verify all above tests still work on other browsers
2. ✅ Ensure no regressions in existing functionality

## API Response Examples

### Valid Time Update
```json
{
  "id": "...",
  "time": "14:30",
  "date": "2025-11-16T12:00:00.000Z",
  ...
}
```

### Empty Time Update
```json
{
  "id": "...",
  "time": null,
  "date": "2025-11-16T12:00:00.000Z",
  ...
}
```

### Invalid Time Format (Error)
```json
{
  "error": "Invalid time format. Expected HH:MM (e.g., 14:30)"
}
```
