# Undo Button State Management Fix

## Problem
When a user deletes rows from the games table and then imports a spreadsheet, both the "Undo Delete" button and "Undo Import" button would appear simultaneously. This creates confusion about which action to undo.

## Solution
When a spreadsheet import completes successfully, the "Undo Delete" button is now automatically removed, leaving only the "Undo Import" button visible.

## Implementation Details

### Changes Made

1. **GamesTable.tsx** (`/src/components/games/GamesTable.tsx`)
   - Modified `handleImportComplete` callback to clear the delete undo state when an import succeeds
   - Added: `useDeleteUndoStore.getState().clearDelete();` after setting imported games

2. **Dashboard Page** (`/src/app/dashboard/page.tsx`)
   - Added import for `useDeleteUndoStore`
   - Modified `onImportComplete` callback in `ImportBox` component to clear delete undo state
   - Ensures consistency across all import entry points

### Logic Flow

```
1. User deletes rows
   → "Undo Delete" button appears
   → Delete state stored in useDeleteUndoStore

2. User imports spreadsheet
   → Import completes successfully
   → "Undo Import" button appears (import state stored)
   → "Undo Delete" button disappears (delete state cleared) ✓

3. User sees only "Undo Import" button
```

## User Experience

### Before Fix
- Delete rows → "Undo Delete" appears
- Import spreadsheet → Both "Undo Delete" and "Undo Import" appear (confusing)

### After Fix
- Delete rows → "Undo Delete" appears
- Import spreadsheet → Only "Undo Import" appears (clear)

## Technical Details

### Affected Components
- `GamesTable.tsx` - Main games management table
- `Dashboard page.tsx` - Dashboard import interface

### Stores Used
- `useImportUndoStore` - Manages imported game IDs and undo functionality
- `useDeleteUndoStore` - Manages deleted game data and undo functionality

### Key Methods
- `setImportedGames(gameIds)` - Sets up import undo state
- `clearDelete()` - Clears delete undo state (removes button)

## Testing Recommendations

1. **Delete and Import Flow**
   - Delete some games → verify "Undo Delete" appears
   - Import a CSV → verify "Undo Delete" disappears and "Undo Import" appears
   - Click "Undo Import" → verify import is undone

2. **Dashboard Import**
   - Delete games from GamesTable
   - Navigate to Dashboard
   - Import via ImportBox
   - Verify "Undo Delete" is cleared

3. **Multiple Imports**
   - Import CSV #1 → "Undo Import" appears
   - Import CSV #2 → Previous import state is replaced (expected behavior)

## Notes

- The 30-second auto-hide timeout for both buttons remains unchanged
- This fix only affects the visibility/state of undo buttons, not the core delete/import functionality
- The change is backward compatible and doesn't affect existing undo operations
