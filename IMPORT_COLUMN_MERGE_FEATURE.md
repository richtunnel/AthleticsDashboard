# Import Column Merge Feature

## Overview
This document describes the implementation of the column merge logic for CSV imports in the games table. When users import spreadsheets, the behavior differs based on whether it's their first import or a subsequent import.

## Feature Behavior

### First Import (No Existing Imported Columns)
When a user imports a spreadsheet for the first time (or has never imported custom columns before):
1. **Complete Override**: The imported columns COMPLETELY REPLACE any default columns
2. **Sample Games Deleted**: Any sample games created during signup are automatically removed
3. **Clean Slate**: Only the user's imported columns are displayed in GamesTable
4. **Column Storage**: Columns are saved to `TablePreference.preferences` as `customColumns` and `columnMapping`

**Example:**
- User imports CSV with columns: "Game Date", "Opponent Name", "Start Time"
- GamesTable displays ONLY these 3 columns (+ actions column)
- NO default columns (Sport, Level, Home/Away, etc.) are shown

### Subsequent Imports (Has Existing Imported Columns)
When a user imports another spreadsheet after already having imported columns:
1. **Smart Merge**: New columns are MERGED with existing imported columns
2. **Preserve Existing**: All previously imported columns are preserved
3. **Add New Only**: Only new unique columns are added to the column list
4. **No Duplicates**: Columns with the same name are not duplicated
5. **Mapping Override**: If a column name exists in both imports, the new mapping overrides the old one

**Example 1: Different Columns**
- Existing columns: "Game Date", "Opponent Name", "Start Time"
- New import: "Game Date", "Coach", "Snack Parent"
- Result: "Game Date", "Opponent Name", "Start Time", "Coach", "Snack Parent" (5 columns total)

**Example 2: Overlapping Columns**
- Existing columns: "Game Date", "Team", "Location"
- New import: "Game Date", "Team", "Bus Info"
- Result: "Game Date", "Team", "Location", "Bus Info" (4 columns, no duplicates)

## Implementation Details

### Backend Changes

#### API Route: `/api/import/games/batch`
**File:** `/src/app/api/import/games/batch/route.ts`

**Key Changes:**
1. Before upserting TablePreference, the API now reads existing preferences
2. Checks if user already has `customColumns` array in preferences
3. If existing columns found:
   - Merges new columns with existing ones
   - Uses Set to avoid duplicates
   - Preserves original column order (existing first, then new)
   - Merges columnMapping objects
4. If no existing columns:
   - Saves new columns as-is (first import behavior)
5. Logs merge activity for debugging

**Code Snippet:**
```typescript
// Check if user already has imported columns
const existingPreference = await prisma.tablePreference.findUnique({
  where: {
    userId_tableKey: {
      userId: session.user.id,
      tableKey: "games",
    },
  },
});

let finalCustomColumns = customColumns;
let finalColumnMapping = columnMapping;

// If user already has imported columns, merge them instead of replacing
if (existingPreference?.preferences) {
  const existingPrefs = existingPreference.preferences as any;
  const existingCustomColumns = existingPrefs.customColumns as string[] | undefined;
  const existingColumnMapping = existingPrefs.columnMapping as Record<string, string> | undefined;

  if (existingCustomColumns && Array.isArray(existingCustomColumns) && existingCustomColumns.length > 0) {
    // Merge columns: Add new columns that don't already exist
    const existingColumnSet = new Set(existingCustomColumns);
    const newUniqueColumns = customColumns.filter((col: string) => !existingColumnSet.has(col));
    finalCustomColumns = [...existingCustomColumns, ...newUniqueColumns];

    // Merge column mappings
    finalColumnMapping = {
      ...(existingColumnMapping || {}),
      ...columnMapping,
    };
  }
}
```

### Frontend Changes

#### Component: ImportBox
**File:** `/src/components/import-export/ImportBox.tsx`

**Key Changes:**
1. Updated `DATABASE_FIELDS` to match CSVImport:
   - Only 3 options: "Date" (required), "Keep as Custom Column", "Skip Column"
   - Removed all specific field mappings (sport, level, opponent, etc.)

2. Updated `autoMapFields()` function:
   - Only auto-maps date columns
   - All other columns default to "preserve" (Keep as Custom Column)

3. Updated `transformData()` function:
   - Only processes "date" and "preserve" mappings
   - Stores all non-date columns in `customFields` JSON object
   - Returns structure: `{ date: ISO_STRING, customFields: {...} }`

4. Updated `handleImport()` function:
   - Sends `customColumns` and `columnMapping` to backend API
   - Matches CSVImport structure exactly
   - Includes per-row error handling

5. Updated info message:
   - Now explains that only Date is required
   - All other columns are preserved as custom columns

## Data Storage

### Database Schema

**Game.customFields (JSON):**
```json
{
  "Opponent Name": "Lincoln High",
  "Start Time": "3:00 PM",
  "Coach": "John Smith",
  "Snack Parent": "Jane Doe"
}
```

**TablePreference.preferences (JSON):**
```json
{
  "customColumns": ["Game Date", "Opponent Name", "Start Time", "Coach", "Snack Parent"],
  "columnMapping": {
    "Game Date": "date",
    "Opponent Name": "preserve",
    "Start Time": "preserve",
    "Coach": "preserve",
    "Snack Parent": "preserve"
  },
  "importedAt": "2025-01-XX..."
}
```

## User Experience Flow

### Scenario 1: New User First Import
1. New user signs up → sample game created
2. User uploads CSV: "Game Date", "Who We're Playing", "What Time"
3. Import UI auto-maps: "Game Date" → Date, others → Keep as Custom Column
4. User clicks Import
5. Backend:
   - Creates games with customFields
   - Deletes sample game
   - Saves column config (no merge, first import)
6. GamesTable displays ONLY: "Game Date", "Who We're Playing", "What Time" (+ actions)

### Scenario 2: Existing User Second Import
1. User already has: "Game Date", "Opponent", "Time"
2. User uploads new CSV: "Game Date", "Location", "Bus Info"
3. Import UI processes columns
4. Backend:
   - Detects existing columns
   - Merges: ["Game Date", "Opponent", "Time", "Location", "Bus Info"]
   - Updates column config
5. GamesTable displays all 5 columns
6. Old games: Show data in "Opponent" and "Time" columns
7. New games: Show data in "Location" and "Bus Info" columns

### Scenario 3: Overlapping Columns
1. User has: "Date", "Opponent", "Score"
2. User uploads: "Date", "Opponent", "Notes"
3. Backend merges: ["Date", "Opponent", "Score", "Notes"]
4. "Date" and "Opponent" not duplicated
5. "Notes" added as new column
6. All games preserve their existing data

## Benefits

1. **Flexibility**: Users can import different spreadsheet formats without losing previous data
2. **Data Preservation**: Old game data remains accessible in original columns
3. **Progressive Enhancement**: Users can gradually add more columns as needed
4. **No Data Loss**: Merging ensures no information is discarded
5. **Intuitive**: Behavior matches user expectations for spreadsheet imports

## Testing Recommendations

1. **First Import Test**:
   - Create new user account
   - Import CSV with custom columns
   - Verify only imported columns shown
   - Verify sample game deleted

2. **Merge Test**:
   - Import first CSV with 3 columns
   - Import second CSV with 2 new columns
   - Verify all 5 columns displayed
   - Verify no duplicates

3. **Overlap Test**:
   - Import CSV with columns A, B, C
   - Import CSV with columns B, C, D
   - Verify result: A, B, C, D (no duplicates)

4. **Data Integrity Test**:
   - Import games with columns X, Y
   - Import games with columns Y, Z
   - Verify old games still show X data
   - Verify new games show Z data
   - Verify Y column shows data from both imports

## Related Files

- `/src/app/api/import/games/batch/route.ts` - Backend merge logic
- `/src/components/import-export/ImportBox.tsx` - Dashboard import component
- `/src/components/games/CSVImport.tsx` - Games table import component (already implemented)
- `/src/components/games/GamesTable.tsx` - Display logic for imported columns
- `/docs/CSV_IMPORT_CUSTOM_COLUMNS_V3.md` - Full documentation
