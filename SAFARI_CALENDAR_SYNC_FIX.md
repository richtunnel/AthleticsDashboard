# Safari Google Calendar Sync Fix

## Issue Description
Google Calendar sync was throwing errors specifically in Safari browser. The sync would work in Chrome, Firefox, and Edge, but fail in Safari with date parsing errors.

## Root Cause
Safari has stricter Date parsing behavior compared to other browsers. The issue was in how dates were being constructed and manipulated:

### Original Code Problem
```typescript
// ❌ Safari-incompatible approach
const eventStart = new Date(game.date); // game.date is ISO string like "2025-11-16T12:00:00.000Z"
if (game.time) {
  const [hours, minutes] = game.time.split(":");
  eventStart.setHours(parseInt(hours), parseInt(minutes));
}
```

### Why This Fails in Safari
1. **Ambiguous Date Parsing**: Safari interprets ISO date strings differently than Chrome/Firefox
2. **Timezone Confusion**: When creating a Date from an ISO string, Safari may apply timezone offsets inconsistently
3. **setHours() Behavior**: Safari's `setHours()` on a Date created from ISO string can produce unexpected results
4. **UTC vs Local Time**: Safari is more strict about distinguishing between UTC and local time operations

### Safari's Date Parsing Quirks
- Safari requires explicit date component handling for consistency
- Creating a Date with `new Date(isoString)` and then using `setHours()` can shift dates by timezone offset
- Safari is less forgiving of timezone ambiguity than other browsers

## Solution
Parse date components explicitly and create Date objects in a Safari-compatible way:

```typescript
// ✅ Safari-compatible approach
// Extract date components from ISO string (YYYY-MM-DD)
const dateStr = game.date.includes('T') ? game.date.split('T')[0] : game.date;
const [year, month, day] = dateStr.split('-').map(num => parseInt(num, 10));

// Create date explicitly in local timezone
const eventStart = new Date(year, month - 1, day, 0, 0, 0, 0);

if (game.time && typeof game.time === 'string' && game.time.trim()) {
  const timeParts = game.time.trim().split(":");
  if (timeParts.length >= 2) {
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    if (!isNaN(hours) && !isNaN(minutes) && hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      eventStart.setHours(hours, minutes, 0, 0);
    }
  }
}

// Create end time using getTime() to avoid reference issues
const eventEnd = new Date(eventStart.getTime());
eventEnd.setHours(eventEnd.getHours() + 2);
```

## Changes Made

### 1. `/src/lib/google/google-calendar-sync.ts`
**Lines 61-81**: Updated date parsing and event time construction

**Benefits:**
- Explicit date component extraction (year, month, day)
- Month is correctly adjusted (month - 1) for JavaScript's 0-based month indexing
- Hours/minutes/seconds/milliseconds all explicitly set to 0 initially
- Time components added safely after date is established
- End time created using `getTime()` to avoid reference issues

### 2. `/src/lib/services/calendar.service.ts`
**Lines 340-354**: Updated date parsing in syncGameToCalendar method

**Benefits:**
- Consistent date handling across both calendar sync implementations
- Same Safari-compatible approach for date parsing
- Maintains timezone support from organization settings

## Technical Details

### Date Constructor Approaches

#### ❌ Problematic (Safari-incompatible):
```typescript
new Date("2025-11-16T12:00:00.000Z")  // Safari may misinterpret
new Date("2025-11-16")                 // Safari may apply timezone offset
```

#### ✅ Safari-compatible:
```typescript
new Date(2025, 10, 16, 0, 0, 0, 0)    // Explicit components (month is 0-based)
new Date(year, month - 1, day, hours, minutes, seconds, milliseconds)
```

### Why This Works in Safari

1. **Explicit Component Construction**: Safari handles explicitly provided date components reliably
2. **No Timezone Ambiguity**: Creating a Date with components uses local timezone consistently
3. **Predictable setHours()**: When starting with explicit components, `setHours()` behaves consistently
4. **No ISO Parsing**: Avoids Safari's stricter ISO string interpretation

## Testing Checklist

### Safari (macOS/iOS)
- [x] Create game and sync to calendar - works without errors
- [x] Update game time and sync - updates calendar event correctly
- [x] Sync game without time - creates all-day event
- [x] Sync game with time - creates timed event at correct hour
- [x] Multiple syncs - consistent behavior
- [x] Different timezones - respects organization timezone

### Other Browsers (Regression Testing)
- [x] Chrome - no regressions
- [x] Firefox - no regressions
- [x] Edge - no regressions
- [x] Mobile browsers - consistent behavior

## Example Scenarios

### Scenario 1: Game with Time
```typescript
// Input
game.date = "2025-11-20T12:00:00.000Z"
game.time = "14:30"

// Process (Safari-safe)
dateStr = "2025-11-20"
[year, month, day] = [2025, 11, 20]
eventStart = new Date(2025, 10, 20, 14, 30, 0, 0)  // Nov 20, 2:30 PM local

// Output
Calendar Event: Nov 20, 2025 at 2:30 PM (2-hour duration)
```

### Scenario 2: Game without Time
```typescript
// Input
game.date = "2025-11-20T12:00:00.000Z"
game.time = null

// Process
dateStr = "2025-11-20"
[year, month, day] = [2025, 11, 20]
eventStart = new Date(2025, 10, 20, 0, 0, 0, 0)  // Nov 20, midnight local

// Output
Calendar Event: Nov 20, 2025 all day
```

## Browser Compatibility Matrix

| Browser | Before Fix | After Fix |
|---------|-----------|-----------|
| Safari (macOS) | ❌ Error | ✅ Works |
| Safari (iOS) | ❌ Error | ✅ Works |
| Chrome | ✅ Works | ✅ Works |
| Firefox | ✅ Works | ✅ Works |
| Edge | ✅ Works | ✅ Works |
| Mobile Chrome/Firefox | ✅ Works | ✅ Works |

## Related Fixes

This fix builds upon the previous Safari time input fix (commit 00c2343):
- Previous fix: Time input validation and normalization
- This fix: Date parsing and calendar sync

Together, these fixes provide comprehensive Safari support for the games scheduling and calendar sync features.

## Deployment Notes

- No database migrations required
- No API changes
- No breaking changes
- Fully backward compatible
- Works with existing calendar events
- Maintains timezone support

## Prevention for Future Development

### Best Practices for Safari-Compatible Date Handling

1. **Always parse date components explicitly**:
   ```typescript
   const [year, month, day] = dateStr.split('-').map(num => parseInt(num, 10));
   const date = new Date(year, month - 1, day, 0, 0, 0, 0);
   ```

2. **Avoid direct ISO string parsing when combining with setHours()**:
   ```typescript
   // ❌ Don't do this
   const date = new Date(isoString);
   date.setHours(hours);
   
   // ✅ Do this
   const [year, month, day] = dateStr.split('-').map(num => parseInt(num, 10));
   const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
   ```

3. **Test date operations in Safari during development**
4. **Use explicit millisecond timestamps when cloning dates**:
   ```typescript
   const clone = new Date(original.getTime());
   ```

5. **Consider using a date library** like `date-fns` or `luxon` for complex date operations

## References

- [MDN: Date Constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Date)
- [Safari Date Parsing Quirks](https://developer.apple.com/forums/thread/691008)
- Previous fix: `SAFARI_TIME_FIX.md` (commit 00c2343)
