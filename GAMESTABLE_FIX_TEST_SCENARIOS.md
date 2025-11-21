# GamesTable Stale State Bug - Test Scenarios

## Critical Test: Delete All Games
**Scenario**: Select all rows and delete all games

**Steps**:
1. Navigate to Games Schedule page
2. Add at least 3 games to the table
3. Click "Select All" checkbox in the table header
4. Verify all rows are selected (blue highlight)
5. Click "Delete" button
6. Confirm deletion in dialog
7. **Expected Result**: 
   - Delete button disappears IMMEDIATELY (before API call completes)
   - Send Email button disappears IMMEDIATELY
   - Copy button disappears IMMEDIATELY
   - After API completes, table shows "No games found" message
   - No error messages in console
   - No stale buttons remain visible

**Before Fix**: Buttons would remain visible even after all games were deleted

**After Fix**: Buttons disappear instantly when user confirms deletion

---

## Test 2: Delete Some Games
**Scenario**: Select and delete only some games

**Steps**:
1. Have 5+ games in the table
2. Select 3 games (not all)
3. Click "Delete" button
4. Confirm deletion
5. **Expected Result**:
   - Delete button disappears immediately
   - Remaining 2 games are still visible
   - Remaining games can be selected
   - No errors occur

---

## Test 3: Delete Game Being Edited (Inline)
**Scenario**: Delete a game while it's being edited inline

**Steps**:
1. Have 3+ games in table
2. Double-click a cell to start inline editing
3. Select the game being edited (using checkbox)
4. Click "Delete" button and confirm
5. **Expected Result**:
   - Game is deleted
   - Inline editing state is cleared
   - No error about editing a deleted game
   - No autosave attempts for deleted game

---

## Test 4: Delete Game Being Edited (Full Row)
**Scenario**: Delete a game while it's being edited in full edit mode

**Steps**:
1. Have 3+ games in table
2. Click "Edit" button on a game row
3. Make some changes but don't save
4. Select that game (may need to select another game instead since edit mode disables checkbox)
5. Delete the game
6. **Expected Result**:
   - Game is deleted
   - Full row editing state is cleared
   - No errors occur

---

## Test 5: Delete with Pending Autosave
**Scenario**: Delete a game that has unsaved changes pending

**Steps**:
1. Have 3+ games in table
2. Double-click a cell and make changes
3. Immediately (within 45 seconds before autosave) select that game
4. Click "Delete" and confirm
5. **Expected Result**:
   - Game is deleted
   - Pending autosave is cancelled
   - No "saved" notification appears after deletion
   - No error about autosave failing

---

## Test 6: Delete Multiple with Mixed States
**Scenario**: Delete multiple games with different editing states

**Steps**:
1. Have 5+ games in table
2. Start editing game 1 (inline)
3. Start editing game 2 (full row)
4. Select games 1, 2, and 3
5. Click "Delete" and confirm
6. **Expected Result**:
   - All 3 games deleted
   - All editing states cleared
   - Remaining games still functional
   - No errors in console

---

## Test 7: Delete with Calendar Sync
**Scenario**: Delete games that are synced to Google Calendar

**Steps**:
1. Have games synced to Google Calendar (with calendarSynced = true)
2. Select synced games
3. Click "Delete" and confirm
4. **Expected Result**:
   - Warning message mentions removing calendar events
   - Games are deleted
   - Notification shows if calendar removal succeeded/failed
   - No stale state remains

---

## Test 8: Cancel Delete Operation
**Scenario**: Start delete but cancel in confirmation dialog

**Steps**:
1. Select multiple games
2. Click "Delete" button
3. Click "Cancel" in confirmation dialog
4. **Expected Result**:
   - Games remain selected
   - Delete button still visible
   - No state changes occur
   - Can still interact with games normally

---

## Test 9: Single Game Delete
**Scenario**: Delete a single game using the row actions menu

**Steps**:
1. Have 3+ games in table
2. Click the "Delete" icon on a single game's action menu
3. Confirm deletion
4. **Expected Result**:
   - Only that game is deleted
   - If game was selected, it's removed from selections
   - If game was being edited, editing state is cleared
   - Other games unaffected

---

## Test 10: Rapid Multiple Deletes
**Scenario**: Delete multiple games in quick succession

**Steps**:
1. Have 10+ games in table
2. Select 3 games and delete
3. Immediately select 3 more games and delete
4. Repeat 2 more times
5. **Expected Result**:
   - All deletions complete successfully
   - No race conditions or conflicts
   - State remains consistent
   - No duplicate API calls

---

## Test 11: Delete All on Last Page
**Scenario**: Delete all games when viewing last page of pagination

**Steps**:
1. Have 30+ games (multiple pages)
2. Navigate to last page (e.g., page 3)
3. Select all games on that page
4. Delete all selected games
5. **Expected Result**:
   - Games deleted
   - Table shows remaining games from earlier pages OR navigates to previous page
   - No blank page with action buttons visible

---

## Test 12: Performance - Delete Large Selection
**Scenario**: Delete 50+ games at once

**Steps**:
1. Import 100 games via CSV
2. Select all games
3. Click "Delete" and confirm
4. **Expected Result**:
   - Action buttons disappear immediately
   - API call processes all deletions
   - UI remains responsive
   - Success notification shows correct count
   - No memory leaks or dangling refs

---

## Automated Test Checklist
After each delete operation, verify:
- [ ] `selectedGameIds` state is empty
- [ ] `inlineEditState` is null
- [ ] `editingGameId` is null
- [ ] `editingGameData` is null
- [ ] `pendingChangesRef.current` has no entries for deleted games
- [ ] `saveTimeoutRef.current` has no entries for deleted games
- [ ] `abortControllersRef.current` has no entries for deleted games
- [ ] `savingGamesRef.current` has no entries for deleted games
- [ ] No errors in browser console
- [ ] Action buttons hidden when `games.length === 0`

---

## Console Error Monitoring
Watch for these potential errors (should NOT appear):
- "Cannot read properties of undefined"
- "Game not found" during autosave
- "TypeError: Cannot read property 'id'"
- AbortError for deleted games
- "Attempted to edit deleted game"
- Memory leak warnings
- React state update on unmounted component

---

## Edge Cases to Test
1. Delete while network is slow (simulate with dev tools)
2. Delete while API is returning error
3. Delete immediately after creating a game
4. Delete while import is in progress
5. Delete while export is in progress
6. Delete while filter is active
7. Delete while sort is applied
8. Delete in "add new game" row is visible
