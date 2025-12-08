# Time Format Validation & Google Calendar Sync Compatibility

## Overview
This document describes the time format validation and auto-correction system implemented to ensure all time values are stored in the correct HH:MM format (24-hour with leading zeros) for Google Calendar sync accuracy.

## Problem
Time values entered by users in various formats (e.g., "3:30", "9:5", "1530") were not being consistently normalized to the HH:MM format required by Google Calendar sync. This caused:
- Inconsistent data in the database
- Potential Google Calendar sync errors
- Timezone-related bugs across different browsers

## Solution
Implemented a comprehensive time validation and normalization system at multiple layers:

### 1. Time Validation Utility (`/src/lib/utils/timeValidation.ts`)

#### Functions

**`normalizeTimeFormat(timeStr: string | null | undefined): string | null`**
- Validates and auto-corrects time to HH:MM format
- Accepts various input formats:
  - Single-digit hours/minutes: "3:30", "9:5"
  - Double-digit format: "14:30", "09:00"
  - Mixed: "3:5", "14:5"
- Returns: Always returns HH:MM format with leading zeros ("03:30", "09:05")
- Throws error for invalid formats with helpful message
- Returns null for empty/TBD values

**`isValidTimeFormat(timeStr: string | null | undefined): boolean`**
- Strict validation for HH:MM format only
- Used for verifying already-normalized times

**`validateAndNormalizeTime(timeStr, fieldName): { value: string | null; error: null } | { value: null; error: string }`**
- User-friendly error messages for API endpoints
- Returns object with either normalized value or error message

### 2. API Endpoints (All Validated)

#### POST /api/games
- Lines 690-701
- Normalizes time on game creation
- Returns 400 error with helpful message if format is invalid

#### PATCH /api/games/[id]
- Lines 66-77: Main time field normalization
- Lines 97-111: Imported time column normalization
- Also normalizes time in imported columns mapped to "time"
- Updates both `time` field and `customFields[timeColumn]` for consistency

#### POST /api/import/games/batch
- Lines 92-108
- Normalizes time during CSV import
- Logs warnings for invalid times but doesn't fail import
- Updates both `time` field and `customFields[timeColumn]`

### 3. Frontend Components

#### CustomTimePicker (`/src/components/ui/CustomTimePicker.tsx`)
- Lines 98-142: Updated `parseTimeInput` function
- Accepts multiple input formats:
  - 12-hour AM/PM: "3:30 PM", "9:5 AM"
  - 24-hour: "15:30", "3:30", "9:5"
  - Compact: "1530", "0900"
- All formats auto-corrected to HH:MM with leading zeros
- Users can type any format, system normalizes automatically

### 4. Google Calendar Sync

#### google-calendar-sync.ts (lines 150-159)
- Validates time format before sync
- Safely parses hours/minutes for datetime construction
- No timezone issues due to consistent format
- Time is sent as local datetime string (not UTC) with timezone parameter

## User Experience Flow

1. **User Input**: User enters time in any format
   - Examples: "3:30 PM", "15:30", "1530", "9:5"

2. **Frontend Normalization**: CustomTimePicker auto-corrects
   - "3:30 PM" → "15:30"
   - "9:5" → "09:05"
   - "1530" → "15:30"

3. **Backend Validation**: API validates and normalizes again (double-check)
   - Ensures consistency even if frontend is bypassed
   - Provides clear error messages if format is completely wrong

4. **Database Storage**: Only normalized HH:MM format stored
   - Consistent data format across all records
   - Easy to query and compare

5. **Google Calendar Sync**: Correctly formatted time used
   - No timezone conversion issues
   - Times match exactly across all browsers

## CSV Import Behavior

- **Time columns detected**: System identifies columns mapped to "time"
- **Auto-normalization**: All time values normalized during import
- **Warning messages**: Invalid times show warnings with row numbers
- **Graceful handling**: Import doesn't fail for bad times, sets to null instead
- **Example warnings**:
  ```
  Row 5: Invalid time format: "abc". Expected format: HH:MM (e.g., 14:30, 09:00). Time set to empty.
  Row 12: Invalid hour: 25. Hours must be between 0 and 23. Time set to empty.
  ```

## Technical Implementation

### Validation Pattern (Backend)
```typescript
import { normalizeTimeFormat } from "@/lib/utils/timeValidation";

// In API routes
if ('time' in body) {
  try {
    body.time = normalizeTimeFormat(body.time);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid time format";
    return NextResponse.json({ 
      success: false, 
      error: `${message}. Use HH:MM format (e.g., 14:30, 09:00) for Google Calendar compatibility.` 
    }, { status: 400 });
  }
}
```

### Validation Pattern (Frontend)
```typescript
// CustomTimePicker automatically normalizes
const parseTimeInput = (input: string): string | null => {
  // ... parsing logic ...
  // Always return HH:MM format with leading zeros
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};
```

## Benefits

1. **Google Calendar Accuracy**: Events always have correct times (no timezone bugs)
2. **Data Consistency**: Uniform HH:MM format across database
3. **User-Friendly**: Auto-correction (types "3:30" → saves as "03:30")
4. **Clear Errors**: Helpful messages when format is completely wrong
5. **Import Flexibility**: CSV imports forgiving (warns but doesn't fail)
6. **Cross-Browser**: Works consistently in Chrome, Firefox, Safari
7. **Type Safety**: TypeScript validates all time handling code

## Testing Recommendations

1. **Valid Formats**: Test "3:30 PM", "15:30", "1530", "9:5"
2. **Invalid Formats**: Test "abc", "25:30", "12:70"
3. **Edge Cases**: Test "0:0", "23:59", empty string, null
4. **CSV Import**: Test with mixed valid/invalid times
5. **Google Calendar**: Verify times sync correctly across timezones

## Future Enhancements

1. Add timezone selection for multi-timezone organizations
2. Support for custom time formats (if needed)
3. Add time validation to inline editing (currently uses modal)

## Files Modified

- `/src/lib/utils/timeValidation.ts` (NEW)
- `/src/app/api/games/route.ts`
- `/src/app/api/games/[id]/route.ts`
- `/src/app/api/import/games/batch/route.ts`
- `/src/components/ui/CustomTimePicker.tsx`

## Related Documentation

- Google Calendar Time Sync: `/GOOGLE_CALENDAR_TIME_SYNC_FIX.md`
- Safari Compatibility: See Memory section "Safari Browser Compatibility"
- CSV Import: `/docs/CSV_IMPORT_CUSTOM_COLUMNS_V3.md`
