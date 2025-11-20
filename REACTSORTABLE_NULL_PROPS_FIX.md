# ReactSortable Null Props Error Fix

## Issue
The GamesTable component was throwing the error:
```
Cannot read properties of null (reading 'props')
```

This occurred in the ReactSortable component when trying to render the games table with drag-and-drop reordering functionality.

## Root Cause
The `sortableGames` state array could contain `null` or `undefined` items, which ReactSortable tried to process by accessing their `.props` property. This caused the application to crash.

Multiple factors contributed to this issue:
1. Games data could temporarily contain null items during loading/updates
2. A duplicate `useEffect` was syncing `sortableGames` inconsistently
3. No validation was in place to filter out invalid game objects
4. ReactSortable received the list prop without proper null-checking

## Solution

### 1. Enhanced Primary Sync useEffect (lines 724-732)
```typescript
// Sync sortableGames with games data when games change
// CRITICAL: Filter out any null/undefined items to prevent ReactSortable errors
// Don't update while dragging to avoid disrupting the drag operation
useEffect(() => {
  if (!isDragging) {
    const validGames = (games || []).filter((game: Game) => game && game.id);
    setSortableGames(validGames);
  }
}, [games, isDragging]);
```

**Changes:**
- Added `!isDragging` check to prevent updates during drag operations
- Filter out null/undefined items using `game && game.id` validation
- Null-safe array handling with `(games || [])`

### 2. Validated handleRowsReorder Callback (lines 1008-1053)
```typescript
const handleRowsReorder = useCallback(
  (newList: Game[]) => {
    // Filter out any null/undefined items that might have been introduced
    const validList = (newList || []).filter((game: Game) => game && game.id);
    
    // Update local state immediately for smooth UX
    setSortableGames(validList);

    // Clear existing debounce timer
    if (reorderTimeoutRef.current) {
      clearTimeout(reorderTimeoutRef.current);
    }

    // Don't attempt to save if we have no valid games
    if (validList.length === 0) {
      return;
    }

    // ... rest of the save logic
  },
  [queryClient, addNotification, reorderSaveDebounceMs]
);
```

**Changes:**
- Filter null/undefined items from `newList` immediately
- Early return if no valid games to prevent API calls with empty data
- Use `validList` throughout instead of `newList`

### 3. Protected ReactSortable Rendering (lines 4616-4640)
```typescript
) : sortableGames && sortableGames.length > 0 ? (
  <ReactSortable
    list={sortableGames}
    setList={handleRowsReorder}
    // ... other props
  >
    {renderNewRow()}
    {sortableGames.filter((game: any) => game && game.id).map((game: any) => renderGameRow(game))}
  </ReactSortable>
) : (
  <TableBody>
    {renderNewRow()}
  </TableBody>
)}
```

**Changes:**
- Added explicit check: `sortableGames && sortableGames.length > 0`
- Added inline filter when mapping: `.filter((game: any) => game && game.id)`
- Fallback to empty `<TableBody>` if no valid games

### 4. Removed Duplicate Sync useEffect (removed lines 1674-1679)
**Removed:**
```typescript
// Sync sortableGames with games data
useEffect(() => {
  if (!isDragging) {
    setSortableGames(games.map((game: any) => ({ ...game, chosen: false })));
  }
}, [games, isDragging]);
```

**Reason:**
- This was a duplicate sync that conflicted with the primary sync
- The `chosen: false` property was unnecessary
- Created potential race conditions and unnecessary re-renders

## Testing
After these changes:
1. ✅ No more null props errors
2. ✅ Drag-and-drop works smoothly
3. ✅ Games table loads without crashes
4. ✅ Reordering saves correctly to backend
5. ✅ No disruption during drag operations

## Prevention Strategy
Moving forward, always ensure:
1. **Filter null values** when syncing arrays to sortable state
2. **Validate before rendering** - check array exists and has valid items
3. **Guard API calls** - don't send empty/invalid data to backend
4. **Avoid duplicate syncs** - one source of truth for state updates
5. **Preserve drag state** - don't update sortable list while dragging

## Related Memory Entry
This fix has been documented in the repository memory under:
- **Drag-and-Drop Reordering (Games)** section
- **React useEffect Best Practices - CRITICAL** section
