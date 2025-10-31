# GamesTable Location and Notes Column Fixes

## Issues Fixed

### 1. Location/Venue Field Not Saving
**Problem:** The location column field in GamesTable was not saving venue name data and reverting to "TBD" on save.

**Root Cause:** The code had conditional logic that only saved the `venueId` when the game was marked as "Away" (`!isHome`). This meant that for "Home" games, the venue would always be set to `null`.

**Fixes Applied:**
- **Line 1086** in `handleSaveEdit()`: Changed from `venueId: !editingGameData.isHome && editingGameData.venueId ? editingGameData.venueId : null,` to `venueId: editingGameData.venueId || editingGameData.venue?.id || null,`
- **Line 1037** in `handleSaveNewGame()`: Changed from `venueId: !newGameData.isHome && newGameData.venueId ? newGameData.venueId : null,` to `venueId: newGameData.venueId || null,`

This ensures that venue data is saved regardless of whether the game is Home or Away.

### 2. Location and Notes Column Text Wrapping
**Problem:** The Location and Notes columns were wrapping text, which increased column sizes and looked unprofessional. The requirement was to have text scale horizontally (overflow-x) like a spreadsheet cell without wrapping.

**Fixes Applied:**

#### Location Column (Lines 2396-2409)
Added CSS properties to the Typography component displaying the venue name:
- `whiteSpace: "nowrap"` - Prevents text from wrapping to new lines
- `overflow: "hidden"` - Hides text that exceeds the container width
- `textOverflow: "ellipsis"` - Shows "..." for truncated text

#### Notes Column (Lines 2499-2512)
- Added `maxWidth: 300` to the TableCell to constrain the column width
- Applied the same CSS properties to the Typography component:
  - `whiteSpace: "nowrap"` - Prevents text from wrapping
  - `overflow: "hidden"` - Hides overflow text
  - `textOverflow: "ellipsis"` - Shows ellipsis for truncated text
- Changed from `whiteSpace: "pre-wrap"` and `wordBreak: "break-word"` which were causing wrapping

## Files Modified
- `/home/engine/project/src/components/games/GamesTable.tsx`

## Result
1. Venue/location data now saves correctly for both Home and Away games
2. Location and Notes columns display text in a single line with ellipsis for overflow, maintaining consistent column widths
3. The table now has a cleaner, more spreadsheet-like appearance
