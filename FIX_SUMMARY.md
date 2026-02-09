# Fix: Custom Columns Showing as Raw IDs in Emails

## Issue
When users sent emails containing custom columns, the raw custom column IDs (like `custom:281b072e-bcc9-43c3-bfe7-1dbafed45770`) were appearing in the email instead of the actual column names and values.

## Root Cause
The backend email sending code (`/home/engine/project/src/app/api/email/send/route.ts`) did not have support for custom columns:
1. The `Game` interface didn't include `customData`
2. The `fetchGames` function only selected `customFields` but not `customData`  
3. The `getColumnLabel` function didn't handle custom column IDs (prefixed with `custom:`)
4. The `getCellValue` function didn't retrieve values from `customData` for custom columns
5. No custom column definitions were fetched to map IDs to names

## Changes Made

### File: `/home/engine/project/src/app/api/email/send/route.ts`

1. **Added `customData` to Game interface** (line 36)
   - Allows the backend to access custom column values stored in `customData` field

2. **Updated `fetchGames` function** (line 216)
   - Added `customData: true` to the select query
   - Ensures custom column data is fetched from the database along with game data

3. **Updated `getColumnLabel` function** (lines 53-77)
   - Added `customColumns` parameter to accept custom column definitions
   - Added handling for `custom:` prefixed column IDs
   - Maps custom column IDs to their display names using fetched custom column definitions
   - Returns the column name (e.g., "Uniform Color") instead of raw ID (e.g., "custom:281b072e-...")

4. **Updated `getCellValue` function** (lines 80-130)
   - Added handling for `custom:` prefixed column IDs
   - Retrieves values from `customData` field for custom columns
   - Returns the actual value or "—" if the value is empty/undefined

5. **Updated `buildScheduleEmailHTML` function** (lines 132-199)
   - Added `customColumns` parameter to accept custom column definitions
   - Updated call to `getColumnLabel` to pass `customColumns` parameter (line 155)

6. **Updated `handleGameScheduleEmail` function** (lines 268-301)
   - Added code to fetch custom columns for the organization (lines 283-296)
   - Queries `prisma.customColumn` to get column definitions
   - Passes custom columns to `buildScheduleEmailHTML` function

## Result
Custom columns now display properly in emails:
- Column headers show the custom column name (e.g., "Uniform Color") instead of the raw ID
- Column cells show the actual custom column values from `customData`
- Hidden columns remain hidden (filtered out by frontend before sending to backend)

## Testing
The fix has been verified to:
- Have no TypeScript syntax errors
- Properly fetch and display custom column data in emails
- Maintain backward compatibility with existing non-custom columns
