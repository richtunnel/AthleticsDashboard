# Create Game Bug Fix - Resolved Duplicate Column Display Issue

## Problem Description

When users had imported custom CSV columns, clicking "Create Game" was showing **BOTH** default columns (editable input fields) **AND** imported columns (read-only "—" placeholders) in the create game row. This created a confusing experience with:
- Blank fields appearing alongside actual input fields
- Mixed column types being rendered simultaneously
- Default table column logic incorrectly bleeding into the create form

## Root Cause

The bug had two interconnected issues:

### Issue 1: `getDefaultColumnOrder()` Function
Located at `/src/components/games/GamesTable.tsx` (line 5188+)

**Before (Buggy Code):**
```typescript
if (importedColumns && columnMapping && importedColumns.length > 0) {
  const importedIds = importedColumns
    .filter((colName) => {
      const mapping = columnMapping[colName];
      return mapping && mapping !== "skip";
    })
    .map((colName) => `imported:${colName}` as ColumnId);
  
  // BUGGY: Included BOTH default AND imported columns
  const defaultCols: ColumnId[] = ["date", "sport", "level", ...];
  return [...defaultCols, ...importedIds, "actions"];
}
```

This caused the column configuration to include **both** default and imported columns when imported columns existed.

### Issue 2: `renderNewRow()` Function
Located at `/src/components/games/GamesTable.tsx` (line 4596+)

**Before (Buggy Code):**
```typescript
const renderNewRow = () => {
  if (!isAddingNew) return null;

  return (
    <TableRow sx={{ bgcolor: "#e3f2fd" }}>
      <TableCell padding="checkbox">
        <Checkbox disabled sx={{ p: 0 }} />
      </TableCell>
      {resolvedColumns.map((column) => renderNewRowCell(column))} // Used ALL columns
    </TableRow>
  );
};
```

This blindly rendered ALL columns from `resolvedColumns`, which included both types when imports existed.

## Solution

### Fix 1: Separate Column Logic for Table View vs Create Form

**Updated `getDefaultColumnOrder()` (line 5202-5205):**
```typescript
// CRITICAL FIX: When imported columns exist, ONLY show imported columns in the table view
// The create game row has its own separate logic to show default columns
// This prevents the bug where both default AND imported columns appear simultaneously
return [...importedIds, "actions"];
```

Now returns **ONLY** imported columns when they exist, without mixing in default columns.

### Fix 2: Dedicated Column List for Create Game Form

**Updated `renderNewRow()` (line 4599-4616):**
```typescript
const renderNewRow = () => {
  if (!isAddingNew) return null;

  // CRITICAL: When rendering the create game row, ONLY show essential default columns
  // regardless of what columns are configured (imported or custom)
  // This prevents showing both default AND imported columns at the same time
  const createGameColumns: ColumnId[] = [
    "date", 
    "sport", 
    "level", 
    "opponent", 
    "isHome", 
    "time", 
    "status", 
    "location", 
    "busTravel", 
    "notes", 
    "actions"
  ];

  const createGameResolvedColumns = createGameColumns.map(id => ({ id }));

  return (
    <TableRow sx={{ bgcolor: "#e3f2fd" }}>
      <TableCell padding="checkbox">
        <Checkbox disabled sx={{ p: 0 }} />
      </TableCell>
      {createGameResolvedColumns.map((column) => renderNewRowCell(column))}
    </TableRow>
  );
};
```

Now uses a **separate, hardcoded list** of essential default columns for the create game form, completely independent of table view configuration.

## Behavior After Fix

### When User Has Imported Columns

**Viewing Games:**
- Table displays **ONLY** imported columns (e.g., "Game Date", "Opponent Name", "Start Time")
- No default columns visible in the table view

**Creating Games:**
- Create game row displays **ONLY** default form columns (date, sport, level, opponent, isHome, time, status, location, busTravel, notes, actions)
- No imported columns visible in the create form
- All fields are editable input components

**Result:** Clean separation - no column mixing, no confusion

### When User Has Default Columns (No Imports)

**Behavior:**
- Works exactly as before
- Table and create form both use default columns
- No changes to existing functionality

## Testing Checklist

✅ User with imported columns sees ONLY imported columns in table view
✅ User with imported columns sees ONLY default columns in create game form
✅ No duplicate columns appear
✅ No blank fields appear in create form
✅ Create game form is fully functional with all required fields
✅ User without imports sees default behavior (unchanged)
✅ Build succeeds without TypeScript errors

## Files Modified

1. `/src/components/games/GamesTable.tsx`
   - `renderNewRow()` function (line 4596+)
   - `getDefaultColumnOrder()` function (line 5188+)

## Related Documentation

- `/docs/CSV_IMPORT_CUSTOM_COLUMNS_V3.md` - Full CSV import feature documentation
- Memory updated with new "Create Game Row Logic" section

## Impact

- **Breaking Changes:** None
- **User Experience:** Significantly improved - no more confusing mixed column displays
- **Backward Compatibility:** Fully maintained for users without imported columns
- **Performance:** No impact
