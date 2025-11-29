# Custom Column Title Display Fix

## Problem
When a user added a custom column in the games table using the "Add Column" button:
1. The column was successfully created in the database
2. **BUT** the column title did not appear in the table header
3. The column was added to the table, but showed as blank or missing title
4. User had to manually refresh the page to see the column title

## Root Cause
The `CustomColumnManager` component was invalidating queries when creating or deleting columns, but it was **not invalidating the table preferences query**. 

When a custom column is created, three queries need to be updated:
1. `["customColumns"]` - the list of custom columns
2. `["games"]` - the games data (to include custom column data)
3. **`["tablePreferences", "games"]` - the table column configuration (order, visibility, titles, widths)**

The missing invalidation of `["tablePreferences", "games"]` meant that:
- The `columnPreferencesData` was stale
- The `defaultColumnOrder` didn't recalculate to include the new column
- The `deriveColumnState` function didn't add the new column to the visible columns
- The `resolvedColumns` didn't include the new column with its metadata (name/title)

## Solution
Added `queryClient.invalidateQueries({ queryKey: ["tablePreferences", "games"] });` to both:

1. **Create Column Mutation** (line 81 in `CustomColumnManager.tsx`):
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["customColumns"] });
  queryClient.invalidateQueries({ queryKey: ["games"] });
  queryClient.invalidateQueries({ queryKey: ["tablePreferences", "games"] }); // ✅ ADDED
  setNewColumnName("");
  setNewColumnType("TEXT");
  setError("");
},
```

2. **Delete Column Mutation** (line 104 in `CustomColumnManager.tsx`):
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["customColumns"] });
  queryClient.invalidateQueries({ queryKey: ["games"] });
  queryClient.invalidateQueries({ queryKey: ["tablePreferences", "games"] }); // ✅ ADDED
},
```

## How It Works
When a custom column is created or deleted, the fix ensures:

1. **Query Invalidation**: All three queries (`customColumns`, `games`, `tablePreferences`) are invalidated and refetched
2. **Column Order Update**: `defaultColumnOrder` recalculates to include/exclude the new/deleted column
3. **Column State Update**: `deriveColumnState` runs and adds/removes the column from the visible column state
4. **Resolved Columns Update**: `resolvedColumns` recalculates to include the new column with its full metadata
5. **Table Re-render**: The table re-renders with the new column and its title visible immediately

## Pattern Consistency
This fix follows the same pattern used elsewhere in the codebase:
- `ImportUndoButton` (GamesTable.tsx:5013) - invalidates both games and tablePreferences
- `ResetColumnsButton` (ResetColumnsButton.tsx:39) - invalidates tablePreferences

## Testing
The fix ensures that:
- ✅ Custom column title appears immediately when created
- ✅ Custom column disappears immediately when deleted
- ✅ No page refresh required
- ✅ Column is added in the correct position
- ✅ Column is visible by default
- ✅ Works for all column types (TEXT, TIME, DROPDOWN, DATETIME)

## Files Changed
- `src/components/games/CustomColumnManager.tsx` - Added table preferences query invalidation to create and delete mutations

## Impact
- **User Experience**: Significantly improved - users no longer need to refresh the page to see newly added columns
- **Performance**: Minimal - one additional query refetch per column add/delete operation
- **Compatibility**: No breaking changes - follows existing patterns
