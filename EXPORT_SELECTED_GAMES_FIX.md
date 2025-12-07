# Export Selected Games Feature Fix

## Summary
Fixed the Export Button in GamesTable to export only selected games/rows instead of all games. The button now displays the count of selected games when selections are made.

## Changes Made

### 1. Updated `handleExport` Function (Line 2479-2500)
**File**: `/src/components/games/GamesTable.tsx`

**Before**:
- Exported ALL games regardless of selection
- Always showed total game count

**After**:
- Exports ONLY selected games when user has made selections
- Exports all games when no selection is made (backward compatible)
- Shows correct count of selected games in the button

**Code Changes**:
```typescript
const handleExport = useCallback(() => {
  // Export selected games if any are selected, otherwise export all games
  const gamesToExport = selectedGames.size > 0 
    ? games.filter((game: Game) => selectedGames.has(game.id))
    : games;

  if (gamesToExport.length === 0) {
    addNotification("No games to export", "warning");
    return;
  }

  trackEvent("Export Games", {
    source: "games_table",
    games_count: gamesToExport.length,
    visible_columns_count: visibleColumnIds.length,
    custom_columns_count: customColumns.length,
    is_partial_selection: selectedGames.size > 0 && selectedGames.size < games.length,
    is_select_all: selectedGames.size === games.length && games.length > 0,
  });

  ExportService.exportGames(gamesToExport, customColumns, visibleColumnIds);
}, [games, customColumns, visibleColumnIds, addNotification, selectedGames]);
```

### 2. Updated Export Button Display (Line 5844-5855)
**File**: `/src/components/games/GamesTable.tsx`

**Before**:
```typescript
<Tooltip title="Export displayed games to CSV">
  <Button>
    Export{selectedGames.size > 0 ? ` (${games.length})` : ""}
  </Button>
</Tooltip>
```

**After**:
```typescript
<Tooltip title={selectedGames.size > 0 ? "Export selected games to CSV" : "Export all games to CSV"}>
  <Button>
    Export{selectedGames.size > 0 ? ` (${selectedGames.size})` : ""}
  </Button>
</Tooltip>
```

## User Experience

### Behavior:
1. **No Selection**: Clicking Export exports ALL games (default behavior)
2. **With Selection**: Clicking Export exports ONLY the selected games
3. **Select All**: Clicking "Select All" checkbox then Export exports all games (as expected)

### Button Display:
- **No games selected**: Shows "Export" (no count)
- **Some games selected**: Shows "Export (N)" where N is the count of selected games
- **All games selected**: Shows "Export (N)" where N is the count of all games

### Tooltip:
- **No games selected**: "Export all games to CSV"
- **Games selected**: "Export selected games to CSV"

## Analytics Enhancement
Added new Mixpanel tracking fields:
- `is_partial_selection`: true when only some games are selected
- `is_select_all`: true when all games are selected
- `games_count`: actual number of games being exported

## Testing Checklist
- [ ] Export with no selection exports all games
- [ ] Export with single selection exports only that game
- [ ] Export with multiple selections exports only selected games
- [ ] Export with "Select All" exports all games
- [ ] Button shows correct count (0, N selected, or nothing)
- [ ] Tooltip text changes based on selection state
- [ ] Exported CSV contains only the intended games
- [ ] Visible columns are correctly exported (only visible ones)

## Files Modified
- `/src/components/games/GamesTable.tsx` (2 locations)

## Backward Compatibility
✅ **Fully backward compatible** - if no games are selected, the export behavior is exactly the same as before (exports all games).

## Date
December 2024
