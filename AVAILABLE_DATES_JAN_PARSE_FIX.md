# Available Dates - January Parsing Fix

## Issue
When the OpenAI API key is invalid or not configured, the Available Dates feature falls back to rule-based parsing. However, the fallback parser was not detecting month names like "January" or "Jan", causing it to return the default 90-day date range starting from the current date (November 2025) instead of dates in January 2026.

### Example Problem
- **Prompt**: "Find dates in January or Jan for a basketball game"
- **Expected**: Dates in January 2026 (2026-01-01 to 2026-01-31)
- **Actual (before fix)**: Dates from November 2025 to February 2026 (default 90-day range)

## Solution
Enhanced the `fallbackParsing` method in `/src/lib/services/available-dates.service.ts` to detect and parse month names.

### Changes Made
1. **Added month detection logic**: Recognizes both full month names ("January", "February", etc.) and short forms ("Jan", "Feb", etc.)
2. **Smart year selection**: 
   - If the target month has passed in the current year, automatically uses next year
   - Example: In November 2025, "January" → January 2026
   - Example: In November 2025, "December" → December 2025 (future month, same year)
3. **Date range calculation**: Generates proper start date (1st of month) and end date (last day of month)

### Month Detection Array
```typescript
const monthNames = [
  { full: 'january', short: 'jan', index: 0 },
  { full: 'february', short: 'feb', index: 1 },
  // ... all 12 months
];
```

### Logic Flow
1. Convert prompt to lowercase for case-insensitive matching
2. Iterate through month names array
3. Check if prompt includes full or short month name
4. If found:
   - Compare target month index with current month
   - If target month < current month → use next year
   - If target month >= current month → use current year
   - Calculate first and last day of target month
   - Format as date range string (YYYY-MM-DD..YYYY-MM-DD)
5. If no month detected, use default 90-day range

## Testing
Verified with test cases in November 2025:
- ✅ "Find dates in January" → 2026-01-01 to 2026-01-31 (next year)
- ✅ "Find dates in Jan" → 2026-01-01 to 2026-01-31 (short form works)
- ✅ "Find dates in November" → 2025-11-01 to 2025-11-30 (current month)
- ✅ "Find dates in December" → 2025-12-01 to 2025-12-31 (future month, same year)

## Backward Compatibility
- Fallback parser still handles all existing patterns:
  - Count extraction: "3 dates" → count: 3
  - Weekends: "weekend" → ["Sat", "Sun"]
  - Weekdays: "weekday" → ["Mon", "Tue", "Wed", "Thu", "Fri"]
  - Home/Away: "home" → homeOnly: true, "away" → awayOnly: true
  - NEW: Month names (full and short forms)

## Files Modified
- `/src/lib/services/available-dates.service.ts` - Enhanced `fallbackParsing()` method

## Related Features
- This fix ensures the Available Dates feature works correctly even when:
  - OpenAI API key is not configured
  - OpenAI API returns an error (e.g., invalid key, rate limit)
  - User is in local development environment without API keys
- The LLM-based parsing (when OpenAI is configured) already handles month names correctly
- This fix only affects the fallback/backup parsing logic
