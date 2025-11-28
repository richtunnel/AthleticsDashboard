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

### Basic Column Filters
1. **Home/Away Filter**:
   - Test filtering by Home only → should show only home games
   - Test filtering by Away only → should show only away games
   - Test filtering by both Home and Away → should show all games
   
2. **Location Filter**:
   - Test filtering by TBD only → should show games with null location and null venue
   - Test filtering by TBD + specific locations → should show games with null location/venue OR the specified locations
   - Test filtering by specific locations only → should show games matching those location values
   
3. **Standard Filters**:
   - Verify sport, level, opponent, status, and busTravel filters work correctly
   - Test date filtering with single and multiple date selections
   - Test notes filtering (Has notes / No notes)

### Custom Column Filters
4. **Custom Column Value Filter**:
   - Create a custom column (via Column Manager)
   - Add data to the custom column for several games
   - Test filtering by selecting multiple values from the custom column filter
   - Verify only games with matching values in `customData` are shown
   
5. **Custom Column Condition Filter**:
   - Test "contains" condition on custom column
   - Test "equals" and "not equals" conditions
   - Test "is empty" and "is not empty" conditions

### Imported Column Filters
6. **Imported Column Value Filter**:
   - Import a CSV with custom columns (e.g., "Coach Name", "Bus Number")
   - Test filtering by selecting multiple values from an imported column
   - Verify only games with matching values in `customFields` are shown
   
7. **Imported Column Condition Filter**:
   - Test "contains" condition on imported column
   - Test "equals" condition on imported column
   - Test "is empty" condition to find games without that field populated

### Edge Cases
8. **Multiple Filters Combined**:
   - Apply filters on standard column + custom column simultaneously
   - Apply filters on imported column + standard column simultaneously
   - Verify AND/OR logic works correctly when combining filters
   
9. **Special Imported Columns**:
   - Test filtering on "Bus Info" or "Travel" columns (if present)
   - These columns have special rendering but should filter normally

10. **Legacy Compatibility**:
    - If any old-style UUID-based custom columns exist, verify they still filter correctly

## Custom Columns & Imported Columns Support

The filter logic now fully supports filtering on:

### 1. Custom Columns (format: `custom:{uuid}`)
- These are user-created custom columns added through the Column Manager
- Data is stored in `Game.customData` JSON field
- Supports both value filters (select multiple values) and condition filters (contains, equals, etc.)

**Example**:
```typescript
// Filter by custom column with ID "custom:abc-123-def"
columnId: "custom:abc-123-def"
values: ["Value1", "Value2"]
// Prisma query: where.customData = { path: ["abc-123-def"], in: ["Value1", "Value2"] }
```

### 2. Imported Columns (format: `imported:{columnName}`)
- These are columns imported from CSV files that preserve the original column names
- Data is stored in `Game.customFields` JSON field
- Supports both value filters and condition filters
- Handles special column detection like "Bus Info" and "Travel"

**Example**:
```typescript
// Filter by imported column "Opponent Name"
columnId: "imported:Opponent Name"
values: ["Team A", "Team B"]
// Prisma query: where.OR = [
//   { customFields: { path: ["Opponent Name"], equals: "Team A" } },
//   { customFields: { path: ["Opponent Name"], equals: "Team B" } }
// ]
```

### 3. Legacy UUID Columns (backward compatibility)
- Supports old-style custom columns identified by UUID length
- Automatically handled in default case for backward compatibility

### Filter Types Supported

**Value Filters** (applyValueFilter):
- Select multiple values from a list
- Used for dropdown/checkbox filtering
- Custom columns: Stored in `customData`
- Imported columns: Stored in `customFields`

**Condition Filters** (applyConditionFilter):
- Advanced filtering with conditions: equals, contains, starts_with, ends_with, is_empty, etc.
- Applies to both custom and imported columns
- Uses Prisma JSON filtering capabilities

## Related Components
- Frontend: `/src/components/games/GamesTable.tsx` (sends filters to API)
- Filter UI: `/src/components/games/ColumnFilterDragDrop.tsx` (user interaction)
- Store: `/src/lib/stores/gamesFiltersStore.ts` (manages filter state)
- Column Configuration: `/src/components/games/CustomColumnManager.tsx` (custom column creation)
- CSV Import: `/src/components/games/CSVImport.tsx` (imported columns)
