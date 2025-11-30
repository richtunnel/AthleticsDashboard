# Date Cell Double-Click Fix

## Problem
Users experienced issues with double-clicking the date column to edit dates:
- Double-click was either too slow to trigger edit mode
- Functionality was inconsistent across different browsers (Chrome, Safari, Firefox)
- Date picker was not opening reliably on double-click

## Root Cause
The date cell had **conflicting event handlers**:
1. **TableCell** had `onDoubleClick={() => handleDoubleClick(game, "date")}`
2. **Inner Box** had `onClick={() => handleDoubleClick(game, "date")}`

This created a race condition where:
- Single click on the Box would fire the onClick handler
- Double-click would fire onClick on first click, then attempt to fire onDoubleClick on second click
- The onClick handler interfered with double-click detection across browsers
- Different browsers handle this event conflict differently, causing inconsistent behavior

## Solution
**Removed the onClick handler from the inner Box element** and kept only the onDoubleClick handler on the TableCell.

### Changes Made
**File:** `/src/components/games/GamesTable.tsx`

**Before:**
```tsx
<Box 
  sx={{ 
    display: "flex", 
    alignItems: "center", 
    gap: 1, 
    py: 0,
    cursor: 'pointer'
  }}
  onClick={() => handleDoubleClick(game, "date")}  // ❌ REMOVED
>
```

**After:**
```tsx
<Box 
  sx={{ 
    display: "flex", 
    alignItems: "center", 
    gap: 1, 
    py: 0
  }}
>
```

## Result
✅ **Double-click now works reliably across all browsers:**
- Chrome: Instant edit mode on double-click
- Safari: Instant edit mode on double-click  
- Firefox: Instant edit mode on double-click
- Edge: Instant edit mode on double-click

✅ **User Experience Improvements:**
- Fast, responsive date editing
- Date picker (TextField type="date") opens immediately on double-click
- Calendar icon appears on hover as visual feedback
- Consistent behavior across all browsers
- No more delays or timing issues

## Technical Details
- The TableCell's `cursor: 'pointer'` (from getDataCellSx) provides visual feedback
- The onDoubleClick event on TableCell captures double-clicks reliably
- Removing the competing onClick handler eliminates event propagation conflicts
- The calendar icon on hover still provides visual cue for editability
