# Compose Email Preview - Custom Columns Support

## Summary
Updated the compose-email section to display the same columns and data that users selected in GamesTable, including custom imported columns from CSV files.

## Problem
Previously, the compose email preview and sent emails used hardcoded default columns (date, time, sport, level, opponent, location, status) regardless of which columns the user had visible in their GamesTable. This created inconsistency and confusion, especially for users who imported custom CSV columns.

## Solution
Implemented dynamic column rendering throughout the email composition and sending flow:

### Frontend Changes (`/src/components/communication/email/ComposeEmail.tsx`)

1. **Added Helper Functions**:
   - `getColumnLabel(columnId)`: Returns display label for any column (default or imported)
   - `getCellValue(game, columnId)`: Extracts cell value from game data for any column type

2. **Updated Game Interface**:
   - Added `customFields?: Record<string, any>` to support imported CSV columns

3. **Dynamic Preview Table Rendering**:
   - Replaced hardcoded column checks with dynamic `visibleColumnIds.map()`
   - Automatically handles imported columns (with `imported:` prefix)
   - Respects user's column selection and order from GamesTable
   - Skips "actions" column in email preview

4. **Dynamic Email HTML Generation**:
   - Updated `generateEmailPreview()` to use `visibleColumnIds` for table headers
   - Dynamic cell generation based on column type
   - Special handling for status (colored chip) and date (formatted) columns
   - Notes row colspan adjusted to match visible column count

5. **Pass Columns to API**:
   - Added `visibleColumnIds` to email send mutation payload
   - Filters out "actions" column before sending to API

### Backend Changes (`/src/app/api/email/send/route.ts`)

1. **Added Helper Functions**:
   - `getColumnLabel(columnId)`: Server-side column label mapping
   - `getCellValue(game, columnId)`: Server-side data extraction
   - `escapeHtml(text)`: HTML escaping utility

2. **Updated Game Interface**:
   - Added `customFields?: Record<string, any>` to Game interface

3. **Updated buildScheduleEmailHTML**:
   - Added `visibleColumnIds?: string[]` parameter
   - Defaults to standard columns if not provided (backward compatibility)
   - Dynamically generates table headers based on visible columns
   - Dynamically generates table cells based on column type
   - Handles imported columns by reading from `game.customFields`

4. **Updated POST Handler**:
   - Accepts `visibleColumnIds` from request body
   - Updated Prisma query to include `customFields` in select
   - Passes `visibleColumnIds` to `buildScheduleEmailHTML()`

5. **Added Import**:
   - Imported `formatLevelDisplay` from `@/lib/utils/formatters`

## Features

### Column Type Support
- **Default Columns**: date, sport, level, opponent, location/isHome, time, status, notes
- **Imported Columns**: Any column imported from CSV (stored in `game.customFields`)
- **Custom Columns**: Future support for user-created columns (with `custom:` prefix)

### Imported Column Handling
- Columns with `imported:` prefix are automatically detected
- Column name extracted from prefix (e.g., `imported:Bus Info` → `Bus Info`)
- Data read from `game.customFields[columnName]`
- Display "—" if no data available

### Special Column Rendering
- **Date**: Formatted with full date display (e.g., "Wednesday, January 15, 2025")
- **Status**: Rendered with colored badge (green for CONFIRMED, blue for others)
- **Location/isHome**: Shows "Home" in bold or venue name
- **Notes**: If visible, adds expanded note row below each game

### Backward Compatibility
- If `visibleColumnIds` not provided, uses default column set
- Existing email campaigns without column info continue to work
- No breaking changes to existing functionality

## Testing Checklist

### Preview Table
- [x] Default columns display correctly
- [x] Imported CSV columns display correctly
- [x] Column order matches GamesTable
- [x] Column labels match GamesTable (including CSV column names)
- [x] Data matches GamesTable values
- [x] Actions column not shown in preview
- [x] Status column shows colored chips

### Sent Emails
- [x] Email HTML includes user's selected columns
- [x] Imported column data appears in emails
- [x] Column order preserved from GamesTable
- [x] Special formatting applied (status colors, dates, etc.)
- [x] Notes row spans correct number of columns

### Edge Cases
- [x] No columns selected (should not occur, but defaults to standard)
- [x] Only imported columns visible
- [x] Mix of default and imported columns
- [x] Games with no customFields data
- [x] Columns with special characters in names

## Related Files
- `/src/components/communication/email/ComposeEmail.tsx` - Frontend preview and form
- `/src/app/api/email/send/route.ts` - Backend email generation
- `/src/components/games/GamesTable.tsx` - Source of column configuration
- `/src/lib/utils/formatters.ts` - Level display formatting

## Impact
- **User Experience**: Emails now match user's table view exactly
- **Consistency**: Preview and sent email always synchronized
- **Flexibility**: Supports any column configuration (default or imported)
- **Maintainability**: Single source of truth for column definitions
