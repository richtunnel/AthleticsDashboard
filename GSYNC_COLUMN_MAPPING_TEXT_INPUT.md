# Google Calendar Group Mapping - Column Name Text Input Feature

## Overview
Enhanced the Calendar Group Mapping feature in the My Calendars (gsync) component to allow users to manually enter column names instead of being restricted to a dropdown with predefined options. The column name field now automatically syncs with imported spreadsheet columns.

## Changes Made

### 1. New API Endpoint
**`/api/user/imported-columns`** (GET)
- Fetches imported column names from user's `TablePreference` for the "games" table
- Returns array of column names that were imported from CSV (excludes skipped columns)
- Used to populate autocomplete suggestions in the mapping modal

### 2. Updated CalendarGroupMappings Component
**File**: `/src/components/calendar/CalendarGroupMappings.tsx`

**Changes**:
- Replaced dropdown `Select` component with `Autocomplete` component (freeSolo mode)
- Column Name is now a text input that:
  - Allows manual typing of any column name
  - Shows autocomplete suggestions from imported spreadsheet columns
  - Updates automatically when user imports new spreadsheets
- Added query to fetch imported columns using `useQuery` with key `["importedColumns"]`
- Helper text adapts based on whether imported columns exist:
  - **With imported columns**: "Select from your imported columns or type a custom name"
  - **Without imported columns**: "Type the column name from your games table"
- Updated info alert to better explain the manual entry functionality

### 3. Query Invalidation for Automatic Sync
To ensure imported columns automatically update after spreadsheet imports, added `importedColumns` query invalidation in:

**GamesTable** (`/src/components/games/GamesTable.tsx`):
- Added invalidation in `handleImportComplete` callback

**Dashboard Page** (`/src/app/dashboard/page.tsx`):
- Added invalidation in `ImportBox` `onImportComplete` callback
- Added invalidation in `ImportUndoButton` `onUndo` callback

**ResetColumnsButton** (`/src/components/settings/ResetColumnsButton.tsx`):
- Added invalidation in reset mutation `onSuccess` callback

## User Experience

### Before Import:
1. User clicks "Add Mapping" button
2. Modal shows text input for Column Name
3. No suggestions available, user must type manually
4. Helper text: "Type the column name from your games table"

### After Import:
1. User imports a CSV with columns: "Game Date", "Opponent Name", "Location", "Coach"
2. User clicks "Add Mapping" button
3. Modal shows text input with autocomplete suggestions:
   - "Game Date"
   - "Opponent Name"
   - "Location"
   - "Coach"
4. User can either:
   - Select from dropdown suggestions
   - Type manually (custom or exact match)
5. Helper text: "Select from your imported columns or type a custom name"

### Automatic Updates:
- When user imports a new spreadsheet, the suggestions update immediately
- No page reload required - uses TanStack Query cache invalidation
- Works across multiple imports (columns merge together)

## Technical Implementation

### Autocomplete Component Props:
```typescript
<Autocomplete
  freeSolo                    // Allow manual text entry
  options={importedColumns}   // Suggestions from imported spreadsheets
  value={newMapping.columnName}
  onChange={(event, newValue) => {
    // Handle dropdown selection
    setNewMapping({ ...newMapping, columnName: newValue || "" });
  }}
  onInputChange={(event, newInputValue) => {
    // Handle manual typing
    setNewMapping({ ...newMapping, columnName: newInputValue });
  }}
  renderInput={(params) => (
    <TextField
      {...params}
      label="Column Name"
      placeholder="Enter or select column name"
      helperText={...}
      fullWidth
    />
  )}
/>
```

### Query Invalidation Pattern:
```typescript
// After import or reset
queryClient.invalidateQueries({ queryKey: ["importedColumns"] });
```

## Benefits

1. **Flexibility**: Users can map any column name, not just predefined ones
2. **Convenience**: Autocomplete suggestions from imported spreadsheets
3. **Automatic Sync**: Column suggestions update immediately after import
4. **Better UX**: No need to remember exact column names - suggestions help
5. **Backward Compatible**: Works for users with or without imported columns

## Database Schema
No database changes required - uses existing `TablePreference.preferences` JSON field which already stores:
```json
{
  "customColumns": ["Game Date", "Opponent Name", "Start Time"],
  "columnMapping": {...}
}
```

## Testing Recommendations

1. Test adding mapping without any imported columns (manual entry only)
2. Test adding mapping after importing a spreadsheet (suggestions appear)
3. Test that suggestions update after importing a second spreadsheet
4. Test manual typing with and without suggestions
5. Test that undo import also updates suggestions
6. Test reset columns functionality updates suggestions
7. Test selecting from dropdown vs manual typing
8. Test partial matches and autocomplete filtering

## Related Files
- `/src/app/api/user/imported-columns/route.ts` (NEW)
- `/src/components/calendar/CalendarGroupMappings.tsx` (UPDATED)
- `/src/components/games/GamesTable.tsx` (UPDATED)
- `/src/app/dashboard/page.tsx` (UPDATED)
- `/src/components/settings/ResetColumnsButton.tsx` (UPDATED)
