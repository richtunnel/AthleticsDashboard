# Games Table Filter Implementation Summary

## Overview
This document provides a comprehensive summary of the games table filter logic implementation, including fixes for standard columns and full support for custom and imported columns.

## Changes Made

### File Modified
**`/src/app/api/games/route.ts`** - Games API endpoint with filter logic

### Functions Updated

#### 1. `applyValueFilter(where, columnId, values)`
Handles filtering when users select multiple values from a list (checkbox/dropdown style filtering).

**Standard Column Fixes**:
- ✅ **isHome filter**: Now correctly handles "Home", "Away", or both selections
- ✅ **location filter**: Now correctly handles "TBD" (null values) in combination with actual locations

**Custom/Imported Column Support**:
- ✅ **custom:{uuid}** columns: Filters data stored in `customData` JSON field
- ✅ **imported:{columnName}** columns: Filters data stored in `customFields` JSON field
- ✅ **Legacy UUID** columns: Backward compatible with old-style custom columns

#### 2. `applyConditionFilter(where, columnId, condition, value, secondValue)`
Handles advanced filtering with conditions (equals, contains, starts_with, etc.).

**Custom/Imported Column Support**:
- ✅ Supports all condition types for custom columns
- ✅ Supports all condition types for imported columns
- ✅ Proper JSON path querying for Prisma

## Filter Types Supported

### Value Filters (Select Multiple)
- Users can select multiple values to filter by
- Creates OR conditions (show games matching any selected value)
- Supported columns:
  - Standard: sport, level, opponent, status, location, isHome, busTravel, notes, date
  - Custom: `custom:{uuid}` format
  - Imported: `imported:{columnName}` format

### Condition Filters (Advanced)
- Users can apply advanced conditions to text/date/number fields
- Conditions supported:
  - `equals`: Exact match
  - `not_equals`: Not equal to
  - `contains`: Contains substring (case-insensitive)
  - `not_contains`: Does not contain substring
  - `starts_with`: Starts with prefix
  - `ends_with`: Ends with suffix
  - `is_empty`: Field is null/empty
  - `is_not_empty`: Field has a value
  - `greater_than`: Greater than value (numbers/dates)
  - `less_than`: Less than value (numbers/dates)
  - `between`: Between two values (numbers/dates)

## Data Storage

### Standard Columns
- Stored as regular database columns in the `Game` table
- Direct field access (e.g., `game.status`, `game.isHome`)

### Custom Columns (`custom:{uuid}`)
- Created through the Custom Column Manager UI
- Data stored in `Game.customData` JSON field
- Schema: `{ [columnId]: "value", ... }`
- Example: `{ "abc-123": "Some Value", "def-456": "Another Value" }`

### Imported Columns (`imported:{columnName}`)
- Created by importing CSV files with custom column names
- Data stored in `Game.customFields` JSON field
- Schema: `{ [columnName]: "value", ... }`
- Example: `{ "Coach Name": "John Smith", "Bus Number": "5" }`

## Technical Implementation

### Value Filter Examples

**Standard Column (isHome)**:
```typescript
// Input: values = ["Home", "Away"]
// Result: No filter (show all games)

// Input: values = ["Home"]
// Result: where.isHome = true (show only home games)
```

**Custom Column**:
```typescript
// Input: columnId = "custom:abc-123", values = ["Value1", "Value2"]
// Result: where.customData = { path: ["abc-123"], in: ["Value1", "Value2"] }
```

**Imported Column**:
```typescript
// Input: columnId = "imported:Coach Name", values = ["John", "Jane"]
// Result: where.OR = [
//   { customFields: { path: ["Coach Name"], equals: "John" } },
//   { customFields: { path: ["Coach Name"], equals: "Jane" } }
// ]
```

### Condition Filter Examples

**Custom Column (contains)**:
```typescript
// Input: columnId = "custom:def-456", condition = "contains", value = "test"
// Result: where.customData = { path: ["def-456"], string_contains: "test" }
```

**Imported Column (equals)**:
```typescript
// Input: columnId = "imported:Bus Number", condition = "equals", value = "5"
// Result: where.customFields = { path: ["Bus Number"], equals: "5" }
```

## Prisma JSON Filtering

The implementation uses Prisma's JSON filtering capabilities:

```typescript
// JSON path filtering
{ path: [key], equals: value }
{ path: [key], in: [val1, val2] }
{ path: [key], string_contains: value }
{ path: [key], not: value }
```

This allows efficient querying of JSON fields without needing to deserialize entire objects.

## OR/AND Logic Handling

When multiple filters are applied:
1. Each filter adds conditions to the `where` clause
2. `OR` is used for value filters within a single column
3. `AND` is implicit when multiple columns are filtered
4. Special handling when `where.OR` already exists (nested OR within AND)

**Example - Multiple filters**:
```typescript
// Filter 1: sport = ["Basketball", "Soccer"]
// Filter 2: level = ["VARSITY"]
// Result: (sport IN ["Basketball", "Soccer"]) AND (level = "VARSITY")
```

## Backward Compatibility

### Legacy UUID Columns
The implementation maintains backward compatibility with old-style custom columns that used raw UUIDs as identifiers:

```typescript
if (columnId.length > 10 && !columnId.startsWith("custom:") && !columnId.startsWith("imported:")) {
  // Legacy handling
  where.customData = { path: [columnId], in: values };
}
```

This ensures existing filters continue to work even if the column ID format changed over time.

## Testing Coverage

### Automated Tests
All filter logic has been tested with automated JavaScript tests:
- ✅ Home/Away filter combinations
- ✅ Location filter with TBD handling
- ✅ Custom column value filters
- ✅ Custom column condition filters
- ✅ Imported column value filters
- ✅ Imported column condition filters
- ✅ Legacy UUID column filters

### Manual Testing Recommended
See `GAMES_TABLE_FILTER_FIX.md` for comprehensive manual testing guidelines covering:
- Basic column filters
- Custom column filters
- Imported column filters
- Edge cases and combined filters

## Performance Considerations

### Indexing
- Standard columns benefit from database indexes
- JSON field filtering (customData, customFields) uses Prisma's JSON operators
- For large datasets, consider adding JSON indexes if supported by database

### Query Optimization
- Value filters use `IN` operator for multiple values (efficient)
- Condition filters use appropriate operators (equals, contains, etc.)
- OR conditions are grouped to minimize query complexity

## Error Handling

The filter logic includes:
- Safe string splitting with validation
- Null/undefined checks before accessing nested properties
- Fallback to legacy handling if column format is unrecognized
- No crashes if columnId is malformed

## Future Enhancements

Potential improvements:
1. Add support for numeric range filters on custom columns
2. Add support for date range filters on custom date columns
3. Implement filter presets (save common filter combinations)
4. Add filter history/undo functionality
5. Optimize JSON queries with database-specific features

## Related Documentation
- Main fix documentation: `GAMES_TABLE_FILTER_FIX.md`
- CSV import documentation: `/docs/CSV_IMPORT_CUSTOM_COLUMNS_V3.md`
- Custom columns feature: Memory documentation in codebase
