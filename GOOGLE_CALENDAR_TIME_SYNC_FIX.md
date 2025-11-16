# Google Calendar Time Sync Fix

## Problem
The time entered in the games table was not syncing correctly to Google Calendar across all browsers. The time displayed in Google Calendar was completely different from the time entered in the application.

## Root Cause
The issue was caused by incorrect date/time handling when creating Google Calendar events:

1. **Previous Implementation**: Created JavaScript `Date` objects in the server's local timezone, set the hours/minutes with `setHours()`, then converted to UTC using `toISOString()`
2. **Result**: When Google Calendar received the UTC timestamp with a timezone parameter, it would interpret the already-converted UTC time in the specified timezone, causing a double timezone conversion

### Example of the Bug
- Game time entered: `14:00` (2 PM)
- Server timezone: EST (UTC-5)
- Old code created: `Date` object with `setHours(14, 0)` in EST = 2 PM EST
- Converted to ISO: `toISOString()` → `19:00Z` (7 PM UTC)
- Sent to Google Calendar: `{ dateTime: "19:00Z", timeZone: "America/New_York" }`
- Google Calendar interpreted: 7 PM Eastern Time (wrong!)

## Solution
When sending datetime to Google Calendar with a timezone parameter, the datetime string should represent the **local time in that timezone** WITHOUT UTC conversion.

### New Implementation
1. Parse the date components from the game date (YYYY-MM-DD)
2. Parse the time components from the game time (HH:mm)
3. Format as a local datetime string: `YYYY-MM-DDTHH:mm:ss` (no Z suffix)
4. Send to Google Calendar with the timezone parameter

### Example of the Fix
- Game time entered: `14:00` (2 PM)
- Date: `2024-01-15`
- Formatted datetime: `2024-01-15T14:00:00`
- Sent to Google Calendar: `{ dateTime: "2024-01-15T14:00:00", timeZone: "America/New_York" }`
- Google Calendar interprets: 2 PM Eastern Time (correct!)

## Files Modified

### 1. `/src/lib/google/google-calendar-sync.ts`
- Removed Date object creation with `toISOString()` conversion
- Implemented direct string formatting for local datetime
- Added proper padding for date/time components
- Improved time parsing validation

### 2. `/src/lib/services/calendar.service.ts`
- Applied the same fix to the `syncGameToCalendar` method
- Ensures consistency across all calendar sync operations
- Uses organization's timezone setting

## Browser Compatibility
This fix maintains Safari compatibility by:
- Continuing to extract date components from ISO strings
- Avoiding direct string manipulation on Date objects
- Using explicit numeric parsing with validation

## Testing
To verify the fix works correctly:
1. Create a new game with a specific time (e.g., 2:00 PM)
2. Sync to Google Calendar
3. Verify the calendar event shows the exact same time (2:00 PM)
4. Test on multiple browsers (Chrome, Firefox, Safari)
5. Test with different timezones in organization settings

## Additional Notes
- Default time is set to 12:00 (noon) if no time is specified
- Event duration defaults to 2 hours
- Handles edge cases like events ending after midnight
- Works with all timezone settings in the organization configuration
