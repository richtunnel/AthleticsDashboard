# CSV Import Custom Columns Feature - Implementation Status

## Overview
This feature allows users to import CSV files with ANY column structure. Only the Date column is required for import. All other columns are preserved exactly as they appear in the user's spreadsheet and displayed dynamically in the GamesTable.

## ✅ Completed Tasks

### 1. Date Required Modal Component
**File**: `/src/components/games/DateRequiredModal.tsx`
- ✅ Created modal that displays when user tries to import without date column
- ✅ Explains why date is required (calendar sync, score tracker, scheduling)
- ✅ Blocks import until date column is mapped
- ✅ User-friendly design with icons and clear messaging

### 2. CSV Import Component Updates
**File**: `/src/components/games/CSVImport.tsx`
- ✅ Simplified mapping options to: Date (required), Keep as Custom Column, Skip Column
- ✅ Auto-mapping now only looks for date columns, all others default to "preserve"
- ✅ Validation checks for date column and shows DateRequiredModal if missing
- ✅ Transform function updated to create structure: `{ date: ISO_STRING, customFields: {...} }`
- ✅ Sends `customColumns` array and `columnMapping` to API
- ✅ Preview displays user's actual column names (not our default column names)
- ✅ Updated mapping step instructions to explain new approach

### 3. Import API Route Rewrite
**File**: `/src/app/api/import/games/batch/route.ts`
- ✅ Completely rewrote to handle new simplified structure
- ✅ Only validates date field (required)
- ✅ Creates/finds "General Schedule" default team for imports without sport/team data
- ✅ Stores all non-date columns in `Game.customFields` JSON
- ✅ Saves column configuration to `TablePreference` (customColumns, columnMapping, importedAt)
- ✅ Returns created game IDs for undo functionality
- ✅ Deletes sample games after successful import

### 4. Database Schema
- ✅ `Game.customFields` (Json) - already exists, now being used
- ✅ `TablePreference.preferences` (Json) - already exists, now storing custom column config

## 🚧 TODO Tasks

### 1. ImportBox Component
**File**: `/src/components/import-export/ImportBox.tsx`
- ❌ Update to match CSVImport logic (same 3 mapping options)
- ❌ Add DateRequiredModal integration
- ❌ Update transformData function to use customFields structure
- ❌ Send customColumns/columnMapping to API

### 2. GamesTable Component
**File**: `/src/components/games/GamesTable.tsx`
- ❌ Read custom column configuration from TablePreference on mount
- ❌ Dynamically render table headers based on customColumns array
- ❌ Display date from Game.date
- ❌ Display other fields from Game.customFields[columnName]
- ❌ Fall back to default columns if no custom config exists (backward compatibility)
- ❌ Update column preferences menu to work with custom columns
- ❌ Ensure sorting/filtering works with custom columns

### 3. Documentation
- ❌ Create `/docs/CSV_IMPORT_CUSTOM_COLUMNS_V3.md` with full implementation details
- ❌ Update user-facing documentation
- ❌ Add migration guide for existing users

### 4. Testing
- ❌ Test import flow with various CSV structures
- ❌ Test GamesTable display with custom columns
- ❌ Test backward compatibility with existing games
- ❌ Test edge cases (empty columns, special characters, very long column names)

## Implementation Notes

### Data Structure
```json
// Game record after import
{
  "id": "...",
  "date": "2024-01-15T00:00:00.000Z",
  "homeTeamId": "general-schedule-team-id",
  "customFields": {
    "Opponent Name": "Lincoln High",
    "Start Time": "3:00 PM",
    "Coach": "John Smith",
    "Snack Parent": "Jane Doe"
  },
  ...
}

// TablePreference record
{
  "userId": "...",
  "tableKey": "games",
  "preferences": {
    "customColumns": ["Game Date", "Opponent Name", "Start Time", "Coach", "Snack Parent"],
    "columnMapping": {
      "Game Date": "date",
      "Opponent Name": "preserve",
      "Start Time": "preserve",
      "Coach": "preserve",
      "Snack Parent": "preserve"
    },
    "importedAt": "2025-01-15T12:00:00.000Z"
  }
}
```

### User Flow
1. User uploads CSV with columns: "Game Date", "Opponent Name", "Start Time", "Coach", "Snack Parent"
2. Import UI auto-maps "Game Date" → Date (required)
3. All other columns auto-mapped to "Keep as Custom Column"
4. User reviews mapping and clicks Import
5. Games created with date + customFields
6. Column configuration saved to TablePreference
7. GamesTable reads configuration and displays custom columns
8. Table shows: "Game Date" | "Opponent Name" | "Start Time" | "Coach" | "Snack Parent"

### Backward Compatibility
- Existing games without customFields will fall back to default column display
- Users who haven't imported will see default columns
- After first import with custom columns, table switches to custom view
- Users can still manually add/edit games (will need to handle customFields in edit forms)

## Next Steps
1. Update ImportBox component to match CSVImport
2. Implement dynamic column rendering in GamesTable
3. Test end-to-end flow
4. Document feature for users
