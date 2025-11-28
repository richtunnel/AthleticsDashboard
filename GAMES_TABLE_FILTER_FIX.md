# Games Table Filter Logic Fix

## Problem Description
The filter functionality in the games table was not working correctly for two specific columns:
1. **Home/Away filter**: When both "Home" and "Away" were selected, only home games were displayed
2. **Location filter**: When "TBD" was selected (alone or with other locations), games with null location/venue were not shown

## Root Causes

### 1. Home/Away Filter Bug
**Location**: `/src/app/api/games/route.ts` - `applyValueFilter()` function, line ~239-241

**Original Code**:
```typescript
case "isHome":
  where.isHome = values.includes("Home");
  break;
```

**Problem**: This logic always set `where.isHome` to either `true` or `false` based on whether "Home" was in the selected values. When both "Home" and "Away" were selected, it set `where.isHome = true`, which only showed home games instead of showing all games.

**Test Cases**:
- `["Home", "Away"]` → Should show ALL games (no filter)
- `["Home"]` → Should show only home games (where.isHome = true)
- `["Away"]` → Should show only away games (where.isHome = false)

### 2. Location TBD Filter Bug
**Location**: `/src/app/api/games/route.ts` - `applyValueFilter()` function, line ~227-237

**Original Code**:
```typescript
case "location":
  const locationValues = values.filter((v) => v !== "TBD");
  
  if (locationValues.length > 0) {
    where.OR = [
      { location: { in: locationValues } },
      { venue: { name: { in: locationValues } } }
    ];
  }
  break;
```

**Problem**: When "TBD" was in the selected values, it was filtered out but no condition was added to check for null location/venue. This meant:
- If only "TBD" was selected, no filter was applied (showed all games)
- If "TBD" + other locations were selected, only the other locations were shown (TBD games excluded)

**Test Cases**:
- `["TBD"]` → Should show games with null location AND null venue
- `["TBD", "Location A"]` → Should show games with null location/venue OR Location A
- `["Location A"]` → Should show games with location = "Location A" OR venue.name = "Location A"

## Solution

### Fixed Home/Away Filter
```typescript
case "isHome":
  // Only apply filter if not both selected
  const includeHome = values.includes("Home");
  const includeAway = values.includes("Away");
  
  if (includeHome && !includeAway) {
    where.isHome = true;
  } else if (!includeHome && includeAway) {
    where.isHome = false;
  }
  // If both or neither selected, don't filter (show all)
  break;
```

**Logic**:
- If only "Home" selected: Filter to `isHome = true`
- If only "Away" selected: Filter to `isHome = false`
- If both selected: Apply no filter (show all games)
- If neither selected: Apply no filter (show all games)

### Fixed Location Filter
```typescript
case "location":
  // Handle location text field or venue names
  const locationValues = values.filter((v) => v !== "TBD");
  const includeTBD = values.includes("TBD");

  if (locationValues.length > 0 || includeTBD) {
    const orConditions: any[] = [];
    
    // Add conditions for actual location values
    if (locationValues.length > 0) {
      orConditions.push(
        { location: { in: locationValues } },
        { venue: { name: { in: locationValues } } }
      );
    }
    
    // Add condition for TBD (null locations and null venues)
    if (includeTBD) {
      orConditions.push(
        { AND: [{ location: null }, { venue: null }] }
      );
    }
    
    where.OR = orConditions;
  }
  break;
```

**Logic**:
- Extract non-TBD values into `locationValues`
- Check if "TBD" is selected with `includeTBD`
- Build OR conditions array:
  - If location values exist: Add conditions for location field IN values OR venue.name IN values
  - If TBD is selected: Add condition for location = null AND venue = null
- Apply OR conditions to where clause

## Test Results

All test cases now pass correctly:

### Home/Away Tests
✅ **Both selected**: No filter applied (shows all games)  
✅ **Only Home**: `where.isHome = true` (shows only home games)  
✅ **Only Away**: `where.isHome = false` (shows only away games)

### Location Tests
✅ **TBD + Location A**: Shows games with null location/venue OR Location A  
✅ **Only TBD**: Shows only games with null location AND null venue  
✅ **Only Location A**: Shows games with location = Location A OR venue.name = Location A

## Impact
- **Files Changed**: 1 (`/src/app/api/games/route.ts`)
- **Lines Modified**: ~40 lines
- **Breaking Changes**: None
- **Backward Compatibility**: Fully compatible - improves existing functionality

## Testing Recommendations
1. Test filtering by Home/Away individually and combined
2. Test filtering by Location with TBD selected
3. Test filtering by Location with TBD + other locations
4. Test filtering by Location without TBD
5. Verify other filters (sport, level, opponent, status) still work correctly

## Related Components
- Frontend: `/src/components/games/GamesTable.tsx` (sends filters to API)
- Filter UI: `/src/components/games/ColumnFilterDragDrop.tsx` (user interaction)
- Store: `/src/lib/stores/gamesFiltersStore.ts` (manages filter state)
