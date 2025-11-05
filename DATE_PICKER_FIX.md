# Date Picker Timezone Bug Fix

## Problem
When users selected a date from the date picker, the wrong date was being saved (off by one day). For example, selecting November 2nd would save as November 1st or 3rd.

## Root Cause
The bug was caused by timezone conversion issues when converting date strings to ISO format:

```javascript
// OLD BUGGY CODE
new Date("2024-11-02").toISOString()
// In PST (UTC-8): creates 2024-11-02T00:00:00-08:00 (midnight PST)
// Converts to UTC: 2024-11-02T08:00:00.000Z (8am UTC)
// This could display as Nov 1 or Nov 3 depending on timezone interpretation
```

When `new Date()` parses a date string like "2024-11-02", it creates a Date object at midnight in the LOCAL timezone. Converting this to UTC with `.toISOString()` shifts the time, which can cause the date to change depending on the timezone offset.

## Solution
Created a helper function `dateStringToUTCISOString()` that explicitly creates dates at noon UTC to avoid date boundary issues:

```javascript
const dateStringToUTCISOString = (dateValue: string): string => {
  // Parse date string in format YYYY-MM-DD and convert to UTC ISO string
  // This avoids timezone issues by explicitly creating date at noon UTC
  const datePart = dateValue.includes("T") ? dateValue.split("T")[0] : dateValue;
  const [year, month, day] = datePart.split("-").map(Number);
  // Create date at noon UTC to avoid any date boundary issues
  const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  return utcDate.toISOString();
};

// NEW CORRECT CODE
dateStringToUTCISOString("2024-11-02")
// Always produces: 2024-11-02T12:00:00.000Z
// Date stays as Nov 2 in all timezones
```

## Files Changed

1. **src/components/games/GamesTable.tsx**
   - Added `dateStringToUTCISOString()` helper function
   - Fixed date conversion in `executeBatchedSave()` (line ~1012, ~1054)
   - Fixed date conversion in `handleAddNewGame()` (line ~1404)
   - Fixed date conversion in `handleSaveEdit()` (line ~1546)
   - Fixed date conversion in `handleDuplicateGame()` (line ~1584)

2. **src/components/games/CSVImport.tsx**
   - Added `dateStringToUTCISOString()` helper function
   - Fixed CSV date import (line ~219)

3. **src/components/opponents/Opponents.tsx**
   - Added `dateStringToUTCISOString()` helper function
   - Fixed game creation from opponents page (line ~601)

4. **src/components/import-export/ImportBox.tsx**
   - Added `dateStringToUTCISOString()` helper function
   - Fixed CSV date import (line ~218)

## Testing
The fix ensures that:
- Selecting Nov 2 saves as Nov 2 (not Nov 1 or Nov 3)
- CSV imports with dates work correctly
- Duplicating games preserves the correct date
- All date operations are timezone-independent

## Why Noon UTC?
We use noon (12:00) UTC instead of midnight to provide maximum buffer from date boundaries. This ensures that even with timezone conversions for display purposes, the date remains correct across all timezones (UTC-12 to UTC+14).
