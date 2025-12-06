# Custom Column Feature Bug Fix

**Date**: December 2, 2024  
**Issue**: Adding custom columns via CustomColumnManager was not working when users had imported CSV columns

## Problem Description

Users reported that when they had imported CSV columns, the ability to add custom columns through the "Add Columns" button (CustomColumnManager) was not working. The custom columns would be created in the database but would not appear in the GamesTable.

## Root Cause

The `getDefaultColumnOrder` function in `/src/components/games/GamesTable.tsx` was only adding custom columns to the column order when users had **NO** imported CSV columns. 

### The Problematic Code (Lines 6257-6263)

```typescript
// No imported columns - use default column order
const customIds = customColumns
  .map((column: any) => column?.id)
  .filter((id: string | undefined): id is string => Boolean(id))
  .map((id: string) => `custom:${id}` as ColumnId);

return ["date", "sport", "level", "opponent", "isHome", "time", "status", "location", "busTravel", ...customIds, "notes", "actions"];
```

This code only ran when there were **no imported columns**. When users had imported CSV columns, the function would exit early (lines 6225-6255) and custom columns would never be added to the column order.

## Solution

Modified the `getDefaultColumnOrder` function to extract and include custom columns in **BOTH** scenarios:

1. **When user has imported CSV columns**: Custom columns are added before the "actions" column
2. **When user has default columns**: Custom columns are added before "notes" and "actions" columns

### The Fixed Code (Lines 6220-6266)

```typescript
function getDefaultColumnOrder(customColumns: any[], preferences: TablePreferencesData | null = null): ColumnId[] {
  // Check if user has imported custom columns from CSV
  const importedColumns = preferences?.customColumns as string[] | undefined;
  const columnMapping = preferences?.columnMapping as Record<string, string> | undefined;

  // CRITICAL FIX: Extract custom column IDs for BOTH imported and default column scenarios
  const customIds = customColumns
    .map((column: any) => column?.id)
    .filter((id: string | undefined): id is string => Boolean(id))
    .map((id: string) => `custom:${id}` as ColumnId);

  if (importedColumns && columnMapping && importedColumns.length > 0) {
    // User imported CSV with custom columns
    const importedIds: ColumnId[] = [];
    let importedDateColumnId: ColumnId | null = null;

    importedColumns.forEach((colName) => {
      const mapping = columnMapping[colName];
      if (mapping && mapping !== "skip") {
        const columnId = `imported:${colName}` as ColumnId;
        if (mapping === "date") {
          importedDateColumnId = columnId;
        }
        importedIds.push(columnId);
      }
    });

    const finalOrder: ColumnId[] = [];

    if (importedDateColumnId) {
      finalOrder.push(...importedIds);
    } else {
      finalOrder.push("date", ...importedIds);
    }

    // CRITICAL FIX: Add custom columns before "actions" when user has imported columns
    finalOrder.push(...customIds, "actions");
    return finalOrder;
  }

  // No imported columns - use default column order with custom columns
  return ["date", "sport", "level", "opponent", "isHome", "time", "status", "location", "busTravel", ...customIds, "notes", "actions"];
}
```

## Key Changes

1. **Line 6226-6229**: Custom column ID extraction moved **BEFORE** the if/else branches, so it runs regardless of whether user has imported columns
2. **Line 6260**: Custom columns are now added before "actions" when user has imported CSV columns
3. **Line 6265**: Custom columns continue to be added before "notes" and "actions" when user has default columns

## Impact

- ✅ Custom columns now work for ALL users regardless of whether they've imported CSV files
- ✅ Custom columns (from CustomColumnManager) and imported columns (from CSV) can coexist
- ✅ Column order remains intuitive: imported columns → custom columns → actions column
- ✅ No breaking changes to existing functionality

## How Custom Columns Work

### Components
- **CustomColumnManager** (`/src/components/games/CustomColumnManager.tsx`): UI for creating and managing custom columns
- **API Route** (`/src/app/api/organizations/custom-columns/route.ts`): Handles CRUD operations for custom columns

### Column Types
- **TEXT**: Simple text field (e.g., "Meal Budget", "Bus Count")
- **TIME**: Time picker (e.g., "Arrival Time")
- **DROPDOWN**: Dropdown selector (custom options)
- **DATETIME**: Date and time picker (e.g., "Bus Departure")

### Data Storage
- **Custom Columns Definition**: Stored in `CustomColumn` table (per organization)
- **Custom Column Data**: Stored in `Game.customData` JSON field
- **Imported Column Data**: Stored in `Game.customFields` JSON field (separate from custom columns)

### Column ID Format
- **Default columns**: `"date"`, `"sport"`, `"level"`, etc.
- **Custom columns**: `"custom:{columnId}"` (e.g., `"custom:abc123"`)
- **Imported columns**: `"imported:{columnName}"` (e.g., `"imported:Game Date"`)

## Testing

To verify the fix works:

1. **Scenario 1: Default Columns + Custom Columns**
   - Start with default columns (no CSV import)
   - Click "Add Columns" → Create a custom column
   - Custom column should appear in the table before the "notes" column

2. **Scenario 2: Imported Columns + Custom Columns**
   - Import a CSV file with custom columns
   - Wait for table to show imported columns
   - Click "Add Columns" → Create a custom column
   - Custom column should appear in the table before the "actions" column

3. **Scenario 3: Mixed Environment**
   - Have both imported CSV columns AND custom columns
   - Reorder columns via Column Preferences
   - All columns (default, imported, custom) should persist correctly

## Related Documentation

- Main feature documentation: `/docs/CSV_IMPORT_CUSTOM_COLUMNS_V3.md`
- Custom column reordering fix: Memory documentation (Dec 2, 2024)
- Column corruption fix: Memory documentation (Dec 2, 2024)

## Files Modified

- `/src/components/games/GamesTable.tsx` (lines 6220-6266)

## Key Insight

Custom columns created via **CustomColumnManager** are stored separately from imported CSV columns:
- Custom columns → `Game.customData` (user-defined via UI)
- Imported columns → `Game.customFields` (from CSV import)

Both column types should be available to users simultaneously. This fix ensures that custom columns are always included in the column order regardless of whether the user has imported a CSV file.
