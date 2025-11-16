# Auto-Save Debounce Fix

## Issue
The auto-save functionality in the GamesTable was triggering too quickly when editing cells, specifically:
- When clicking on the time modal to adjust game times
- When manually editing the date input field

The previous 800ms debounce delay was too short, causing auto-save to fire before users completed their edits.

## Solution
Changed the auto-save debounce delay from **800ms to 10 seconds (10000ms)**.

### File Changed
- `src/components/games/GamesTable.tsx` (line 1292)

### Before
```typescript
const delay = immediate ? 0 : 800; // 800ms debounce for responsive auto-save
```

### After
```typescript
const delay = immediate ? 0 : 10000; // 10 seconds debounce to prevent premature auto-save during editing
```

## Behavior After Fix

### Auto-Save Triggers
1. **After 10 seconds of inactivity** - If you stop editing for 10 seconds, changes are automatically saved
2. **Immediately on blur** - When you click away from a field to another area
3. **Immediately on Enter** - When you press the Enter key while editing a field
4. **Cancel on Escape** - Pressing Escape cancels the edit and pending saves

### User Benefits
- **Time Modal**: Users can now open the time picker, adjust hours/minutes, change AM/PM, and click Apply without auto-save firing prematurely
- **Date Input**: Users can manually type or use the date picker without auto-save interrupting their workflow
- **Multiple Edits**: Users can make several quick edits across fields without triggering multiple auto-saves
- **Manual Control**: Users retain immediate save control via Enter key or clicking away

## Technical Details

### How It Works
The `scheduleAutosave` function uses a debounced timer that:
1. Stores pending changes in `pendingChangesRef`
2. Clears any existing timer for the game being edited
3. Sets a new timer with the configured delay
4. Executes a batched save when the timer expires

### Immediate vs Debounced Save
- `immediate: true` - Used for blur events and Enter key (delay = 0ms)
- `immediate: false` - Used for onChange events while typing/editing (delay = 10000ms)

This ensures users have control over when saves happen while still providing automatic backup after a reasonable period of inactivity.
